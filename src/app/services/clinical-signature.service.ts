import { Injectable } from '@angular/core';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';

import { auth, db } from '../firebase';
import { ClinicalAuditService } from './clinical-audit.service';
import { ClinicalIdentityService, ClinicalIdentitySnapshot } from './clinical-identity.service';
import { ClinicalVisitLink, matchesClinicalVisitLink } from '../shared/clinical-visit-link';

export type FieldSignableKind =
  | 'assessment'
  | 'care_plan'
  | 'progress_note'
  | 'education'
  | 'order';

export interface FieldSignableDocument {
  id: string;
  kind: FieldSignableKind;
  title: string;
  subtitle: string;
  collectionPath: string;
  signed: boolean;
  locked: boolean;
  canSign: boolean;
  signerRequirement: string | null;
  raw: Record<string, any>;
}

@Injectable({ providedIn: 'root' })
export class ClinicalSignatureService {
  constructor(
    private readonly identity: ClinicalIdentityService,
    private readonly audit: ClinicalAuditService,
  ) {}

  async listVisitDocuments(
    patientId: string,
    visitLink: ClinicalVisitLink,
  ): Promise<FieldSignableDocument[]> {
    if (!patientId) throw new Error('Patient is required.');
    const actor = await this.identity.requireCurrentIdentity();

    const configs: Array<{ kind: FieldSignableKind; collection: string }> = [
      { kind: 'assessment', collection: 'woundAssessments' },
      { kind: 'care_plan', collection: 'carePlans' },
      { kind: 'progress_note', collection: 'providerNotes' },
      { kind: 'education', collection: 'educationRecords' },
      { kind: 'order', collection: 'orders' },
    ];

    const batches = await Promise.all(configs.map(async (config) => {
      try {
        const snap = await getDocs(collection(db, `patients/${patientId}/${config.collection}`));
        return snap.docs
          .map((item) => ({ id: item.id, ...(item.data() as Record<string, any>) }))
          .filter((row) => matchesClinicalVisitLink(row, visitLink))
          .map((row) => this.toSignable(patientId, config.kind, config.collection, row, actor));
      } catch (error) {
        console.warn('[ClinicalSignatureService] source unavailable', config.collection, error);
        return [];
      }
    }));

    return batches
      .flat()
      .sort((a, b) => this.sortKey(a).localeCompare(this.sortKey(b)));
  }

  async sign(
    patientId: string,
    document: FieldSignableDocument,
  ): Promise<void> {
    if (!auth.currentUser) throw new Error('Sign in required.');
    const actor = await this.identity.requireCurrentIdentity();
    if (actor.uid !== auth.currentUser.uid) {
      throw new Error('Clinical identity does not match the authenticated user.');
    }

    const ref = doc(db, document.collectionPath);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Clinical document no longer exists.');
    const current = { id: snap.id, ...(snap.data() as Record<string, any>) };
    const latest = this.toSignable(
      patientId,
      document.kind,
      document.collectionPath.split('/').slice(-2, -1)[0],
      current,
      actor,
    );
    if (latest.signed) throw new Error('This document is already signed.');
    if (!latest.canSign) {
      throw new Error(latest.signerRequirement || 'You are not the authorized signer for this document.');
    }

    switch (document.kind) {
      case 'assessment':
        await this.signAssessment(ref, current, actor);
        break;
      case 'progress_note':
        await this.signProgressNote(ref, current, actor);
        break;
      case 'care_plan':
        await this.signGenericAuthoredRecord(ref, current, actor, 'CARE_PLAN');
        break;
      case 'education':
        await this.signGenericAuthoredRecord(ref, current, actor, 'EDUCATION');
        break;
      case 'order':
        await this.signOrder(ref, current, actor);
        break;
    }

    await this.audit.record({
      action: 'clinical_document_signed',
      patientId,
      entityType: document.kind,
      entityId: document.id,
      metadata: { source: 'woundapp_field_signature_center' },
    });
  }

  private async signAssessment(ref: any, row: Record<string, any>, actor: ClinicalIdentitySnapshot): Promise<void> {
    const authorUid = this.assessmentAuthorUid(row);
    if (!authorUid || authorUid !== actor.uid) {
      throw new Error('Only the clinician who authored this wound assessment can sign it.');
    }
    await updateDoc(ref, {
      esign: {
        signed: true,
        signerDisplayName: actor.displayName,
        signerUid: actor.uid,
        signedAtIso: new Date().toISOString(),
        signedAt: serverTimestamp(),
        attestationText: 'I attest that I reviewed this wound assessment and that it accurately reflects my clinical documentation for this encounter.',
        recordType: 'WOUND_ASSESSMENT',
        recordId: row['id'],
      },
      locked: true,
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    });
  }

  private async signProgressNote(ref: any, row: Record<string, any>, actor: ClinicalIdentitySnapshot): Promise<void> {
    const authorUid = this.progressNoteAuthorUid(row);
    if (!authorUid || authorUid !== actor.uid) {
      throw new Error('Only the clinician who authored this progress note can sign it.');
    }
    if (row['status'] !== 'draft' || row['draft'] !== true || row['signed'] === true) {
      throw new Error('Only an unsigned draft progress note can be signed.');
    }
    await updateDoc(ref, {
      status: 'signed',
      draft: false,
      signed: true,
      signedAt: serverTimestamp(),
      signedByUid: actor.uid,
      signatureIdentity: actor,
      updatedAt: serverTimestamp(),
    });
  }

  private async signGenericAuthoredRecord(
    ref: any,
    row: Record<string, any>,
    actor: ClinicalIdentitySnapshot,
    recordType: 'CARE_PLAN' | 'EDUCATION',
  ): Promise<void> {
    const authorUid = recordType === 'CARE_PLAN'
      ? this.carePlanAuthorUid(row)
      : this.educationAuthorUid(row);
    if (!authorUid || authorUid !== actor.uid) {
      throw new Error('Only the clinician who authored this document can sign it.');
    }

    await updateDoc(ref, {
      esign: {
        signed: true,
        signerUid: actor.uid,
        signerDisplayName: actor.displayName,
        signerIdentity: actor,
        signedAtIso: new Date().toISOString(),
        signedAt: serverTimestamp(),
        attestationText: 'I attest that I reviewed this document and that it accurately reflects the care I documented for this encounter.',
        recordType,
        recordId: row['id'],
      },
      locked: true,
      updatedAt: serverTimestamp(),
      updatedBy: actor,
    });
  }

  private async signOrder(ref: any, row: Record<string, any>, actor: ClinicalIdentitySnapshot): Promise<void> {
    const receiptMethod = String(row['receiptMethod'] || 'direct').toLowerCase();
    if (receiptMethod === 'telephone' || receiptMethod === 'verbal') {
      const expectedUid = String(row['coSignature']?.provider?.uid || '');
      const recordedByUid = String(row['orderedBy']?.uid || '');
      if (!expectedUid || expectedUid !== actor.uid) {
        throw new Error('Only the prescriber named on this telephone/verbal order can co-sign it.');
      }
      if (recordedByUid && recordedByUid === actor.uid) {
        throw new Error('The clinician who recorded a telephone/verbal order cannot co-sign their own entry.');
      }
      await updateDoc(ref, {
        coSignature: {
          ...row['coSignature'],
          status: 'signed',
          signedAt: serverTimestamp(),
          signedBy: this.auditIdentity(actor),
          attestationText: 'I confirm this order was given by me and accurately reflects my clinical instructions.',
        },
        locked: true,
        updatedAt: serverTimestamp(),
        updatedBy: this.auditIdentity(actor),
      });
      return;
    }

    const orderedByUid = String(row['orderedBy']?.uid || '');
    if (!orderedByUid || orderedByUid !== actor.uid || !this.isPrescriber(actor)) {
      throw new Error('Only the ordering prescriber can sign a direct clinical order.');
    }
    await updateDoc(ref, {
      esign: {
        signed: true,
        signerUid: actor.uid,
        signerDisplayName: actor.displayName,
        signerIdentity: actor,
        signedAtIso: new Date().toISOString(),
        signedAt: serverTimestamp(),
        attestationText: 'I attest that I authored and reviewed this clinical order.',
        recordType: 'ORDER',
        recordId: row['id'],
      },
      locked: true,
      updatedAt: serverTimestamp(),
      updatedBy: this.auditIdentity(actor),
    });
  }

  private toSignable(
    patientId: string,
    kind: FieldSignableKind,
    collectionName: string,
    row: Record<string, any>,
    actor: ClinicalIdentitySnapshot,
  ): FieldSignableDocument {
    const path = `patients/${patientId}/${collectionName}/${row['id']}`;
    let signed = false;
    let locked = row['locked'] === true;
    let canSign = false;
    let signerRequirement: string | null = null;

    if (kind === 'assessment') {
      signed = row['esign']?.signed === true;
      canSign = !signed && !locked && this.assessmentAuthorUid(row) === actor.uid;
      signerRequirement = canSign ? null : 'Assessment signature belongs to the original documenting clinician.';
    } else if (kind === 'progress_note') {
      signed = row['signed'] === true || ['signed', 'amended'].includes(String(row['status'] || ''));
      locked = signed;
      canSign = !signed && row['status'] === 'draft' && this.progressNoteAuthorUid(row) === actor.uid;
      signerRequirement = canSign ? null : 'Progress note signature belongs to the note author.';
    } else if (kind === 'care_plan') {
      signed = row['esign']?.signed === true;
      canSign = !signed && !locked && this.carePlanAuthorUid(row) === actor.uid;
      signerRequirement = canSign ? null : 'Care plan signature belongs to the clinician who authored the plan.';
    } else if (kind === 'education') {
      signed = row['esign']?.signed === true;
      canSign = !signed && !locked && this.educationAuthorUid(row) === actor.uid;
      signerRequirement = canSign ? null : 'Education signature belongs to the clinician who documented the teaching.';
    } else {
      const receiptMethod = String(row['receiptMethod'] || 'direct').toLowerCase();
      if (receiptMethod === 'telephone' || receiptMethod === 'verbal') {
        signed = row['coSignature']?.status === 'signed';
        canSign = !signed &&
          row['coSignature']?.provider?.uid === actor.uid &&
          row['orderedBy']?.uid !== actor.uid;
        signerRequirement = canSign ? null : 'Awaiting the named prescriber co-signature.';
      } else {
        signed = row['esign']?.signed === true;
        canSign = !signed && !locked && row['orderedBy']?.uid === actor.uid && this.isPrescriber(actor);
        signerRequirement = canSign ? null : 'Direct orders must be signed by the ordering prescriber.';
      }
    }

    return {
      id: String(row['id']),
      kind,
      title: this.title(kind, row),
      subtitle: this.subtitle(kind, row),
      collectionPath: path,
      signed,
      locked,
      canSign,
      signerRequirement,
      raw: row,
    };
  }

  private assessmentAuthorUid(row: Record<string, any>): string {
    return String(row['authorIdentity']?.uid || row['createdByUid'] || row['createdBy'] || '');
  }

  private progressNoteAuthorUid(row: Record<string, any>): string {
    return String(row['authorIdentity']?.uid || row['providerUid'] || row['createdBy'] || '');
  }

  private carePlanAuthorUid(row: Record<string, any>): string {
    return String(row['authorIdentity']?.uid || row['createdBy']?.uid || row['createdBy'] || '');
  }

  private educationAuthorUid(row: Record<string, any>): string {
    return String(row['deliveredBy']?.uid || row['createdBy']?.uid || row['createdBy'] || '');
  }

  private isPrescriber(actor: ClinicalIdentitySnapshot): boolean {
    const roles = [actor.role, ...(actor.roles || [])].map((role) => String(role || '').toLowerCase());
    return roles.some((role) => ['provider', 'np', 'md', 'do', 'physician'].includes(role));
  }

  private auditIdentity(actor: ClinicalIdentitySnapshot): Record<string, string | null> {
    return {
      uid: actor.uid,
      displayName: actor.displayName,
      role: actor.role,
      credentials: actor.credentials || null,
      npi: actor.npi || null,
    };
  }

  private title(kind: FieldSignableKind, row: Record<string, any>): string {
    if (kind === 'assessment') {
      const type = row['describe']?.type || row['type'] || 'Wound assessment';
      const location = row['describe']?.location || row['location'] || '';
      return location ? `${type} — ${location}` : String(type);
    }
    if (kind === 'care_plan') return String(row['title'] || 'Plan of care');
    if (kind === 'progress_note') return String(row['type'] || 'Progress note');
    if (kind === 'education') return String(row['topic'] || 'Patient / caregiver education');
    return String(row['orderType'] || 'Clinical order');
  }

  private subtitle(kind: FieldSignableKind, row: Record<string, any>): string {
    if (kind === 'assessment') return 'Wound assessment';
    if (kind === 'care_plan') return 'Plan of care';
    if (kind === 'progress_note') return String(row['providerName'] || row['authorIdentity']?.displayName || 'Progress note');
    if (kind === 'education') return String(row['deliveredBy']?.displayName || 'Education record');
    const method = String(row['receiptMethod'] || 'direct');
    return method === 'direct' ? 'Direct provider order' : `${method} order · prescriber co-sign`;
  }

  private sortKey(doc: FieldSignableDocument): string {
    const order: Record<FieldSignableKind, string> = {
      assessment: '1',
      care_plan: '2',
      order: '3',
      education: '4',
      progress_note: '5',
    };
    return `${order[doc.kind]}-${doc.title}`;
  }
}