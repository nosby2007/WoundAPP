// src/app/services/progress-note.service.ts
import { Injectable } from '@angular/core';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { ClinicalIdentityService, ClinicalIdentitySnapshot } from './clinical-identity.service';
import { ClinicalAuditService } from './clinical-audit.service';
import { ClinicalVisitLink, clinicalVisitLinkFields } from '../shared/clinical-visit-link';

export interface ProgressNote {
  id: string;
  details: string;
  effectiveAt: Date | null;
  providerName: string;
  providerUid: string | null;
  authorIdentity: ClinicalIdentitySnapshot | null;
  woundId: string | null;
  woundLabel: string | null;
}

export interface ProgressNoteWoundContext {
  woundId: string;
  woundAssessmentId: string;
  label: string;
}

export interface ProgressNoteVoiceProvenance {
  sessionId: string;
  transcriptSha256: string;
  durationSeconds: number;
  mimeType: string;
  recordedAtIso: string;
  language?: string | null;
}

export interface TelehealthProgressNoteContext {
  telehealthSessionId: string;
  appointmentId: string;
  deliveryMode: 'telehealth_video' | 'telehealth_audio';
  serviceDateIso?: string | null;
  documentation?: {
    modality: 'Video' | 'Audio-only';
    consent: string;
    patientLocation: string;
    participants: string;
    identityVerification: string;
    observedFindings: string;
    examLimitations: string;
    assessmentAndPlan: string;
    followUpAndPrecautions: string;
  } | null;
}

export interface NewProgressNoteLifecycle {
  status: 'draft';
  draft: true;
  signed: false;
  signedAt: null;
  signedByUid: null;
  signatureIdentity: null;
  version: 1;
  rootNoteId: null;
  supersedesNoteId: null;
  amendmentReason: null;
}

/**
 * Mobile documentation enters the shared JADE review-and-sign lifecycle as a
 * draft.  These fields are intentionally explicit: Firestore validates the
 * state machine and will reject a legacy shape whose state is ambiguous.
 */
export function newProgressNoteLifecycle(): NewProgressNoteLifecycle {
  return {
    status: 'draft',
    draft: true,
    signed: false,
    signedAt: null,
    signedByUid: null,
    signatureIdentity: null,
    version: 1,
    rootNoteId: null,
    supersedesNoteId: null,
    amendmentReason: null,
  };
}

export class NotAuthenticatedError extends Error {
  constructor() {
    super('You are signed out. Sign in again to write a note.');
    this.name = 'NotAuthenticatedError';
  }
}

/**
 * Writes bedside notes into the same providerNotes collection JADE-SHOP uses.
 * New records carry both the legacy providerName/providerUid fields and an
 * immutable canonical authorIdentity snapshot resolved from users/{uid}.
 * Email addresses are never used as clinical author names.
 */
@Injectable({ providedIn: 'root' })
export class ProgressNoteService {
  constructor(private clinicalIdentity: ClinicalIdentityService, private audit: ClinicalAuditService) {}

  async create(
    patientId: string,
    details: string,
    wound?: ProgressNoteWoundContext | null,
    voiceProvenance?: ProgressNoteVoiceProvenance | null,
    visitLink: ClinicalVisitLink = {},
    telehealth?: TelehealthProgressNoteContext | null,
  ): Promise<string> {
    if (!patientId) throw new Error('ProgressNoteService.create(): patientId is missing.');
    const text = (details || '').trim();
    if (!text) throw new Error('ProgressNoteService.create(): the note is empty.');

    const user = auth.currentUser;
    if (!user) throw new NotAuthenticatedError();
    const identity = await this.clinicalIdentity.requireCurrentIdentity();
    if (identity.uid !== user.uid) throw new Error('Clinical identity does not match the authenticated user.');

    const now = serverTimestamp();
    const payload: Record<string, unknown> = {
      patientId,
      ...clinicalVisitLinkFields({
        ...visitLink,
        woundId: wound?.woundId ?? visitLink.woundId ?? null,
      }),
      type: 'Progress Notes',
      details: text,
      effectiveAt: now,
      providerName: identity.displayName,
      providerUid: identity.uid,
      authorIdentity: identity,
      createdBy: identity.uid,
      createdAt: now,
      updatedAt: now,
      contentOrigin: voiceProvenance ? 'human_modified_voice' : 'human',
      voiceProvenance: voiceProvenance ?? null,
      humanReviewed: true,
      ...(telehealth ? {
        appointmentId: telehealth.appointmentId,
        telehealthSessionId: telehealth.telehealthSessionId,
        deliveryMode: telehealth.deliveryMode,
        serviceDate: telehealth.serviceDateIso || null,
        visitType: 'Telehealth',
        telehealthDocumentation: telehealth.documentation || null,
      } : {}),
      ...newProgressNoteLifecycle(),
    };

    if (wound) {
      payload['woundId'] = wound.woundId;
      payload['woundAssessmentId'] = wound.woundAssessmentId;
      payload['woundLabel'] = wound.label;
    }

    const ref = await addDoc(collection(db, `patients/${patientId}/providerNotes`), payload);

    // The progress note is the field clinician's explicit office-documentation
    // evidence for this physical encounter. Only project completion when the
    // field visit is already complete; checkout separately reconciles notes
    // authored before departure.
    const physicalVisitId = String(
      visitLink.fieldEncounterVisitId || visitLink.appointmentId || visitLink.visitId || ''
    ).trim();
    if (physicalVisitId) {
      try {
        const visitRef = doc(db, `patients/${patientId}/woundVisits/${physicalVisitId}`);
        const visitSnap = await getDoc(visitRef);
        if (visitSnap.exists()) {
          const visit = visitSnap.data() as any;
          const fieldComplete = !!visit.checkOut ||
            visit.fieldVisitState === 'completed' ||
            visit.status === 'completed';
          if (fieldComplete && visit.officeDocumentationState !== 'complete') {
            await updateDoc(visitRef, {
              officeDocumentationState: 'complete',
              officeDocumentationCompletedAt: serverTimestamp(),
              officeDocumentationCompletedBy: identity.uid,
              updatedAt: serverTimestamp(),
              updatedBy: identity.uid,
            });
          }
        }
      } catch (workflowError) {
        console.warn('[ProgressNoteService] note saved; visit office-documentation projection deferred', {
          patientId,
          physicalVisitId,
          noteId: ref.id,
        }, workflowError);
      }
    }

    await this.audit.record({ action: 'progress_note_created', patientId, entityType: 'providerNote', entityId: ref.id, metadata: { woundLinked: !!wound, physicalVisitId: physicalVisitId || null } });
    return ref.id;
  }

  async getDraft(patientId: string, noteId: string): Promise<{ id: string; details: string } | null> {
    if (!patientId || !noteId) return null;
    const snap = await getDoc(doc(db, `patients/${patientId}/providerNotes/${noteId}`));
    if (!snap.exists()) return null;
    const row: any = snap.data();
    if (row.status !== 'draft' || row.draft !== true || row.signed === true) return null;
    return { id: snap.id, details: String(row.details || '') };
  }

  async updateDraft(patientId: string, noteId: string, details: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new NotAuthenticatedError();
    const ref = doc(db, `patients/${patientId}/providerNotes/${noteId}`);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Draft note not found.');
    const row: any = snap.data();
    const authorUid = row.authorIdentity?.uid || row.providerUid || row.createdBy || null;
    if (authorUid !== user.uid || row.status !== 'draft' || row.draft !== true || row.signed === true) {
      throw new Error('Only the author may update this unsigned draft.');
    }
    await updateDoc(ref, {
      details: String(details || '').trim(),
      updatedAt: serverTimestamp(),
      updatedByUid: user.uid,
    });
  }

  async list(patientId: string, max = 20): Promise<ProgressNote[]> {
    if (!patientId) throw new Error('ProgressNoteService.list(): patientId is missing.');
    const q = query(
      collection(db, `patients/${patientId}/providerNotes`),
      orderBy('effectiveAt', 'desc'),
      limit(max),
    );
    const snap = await getDocs(q);

    return snap.docs.map((d) => {
      const data: any = d.data();
      const authorIdentity = this.asIdentity(data.authorIdentity);
      return {
        id: d.id,
        details: data.details || '',
        effectiveAt: typeof data.effectiveAt?.toDate === 'function' ? data.effectiveAt.toDate() : null,
        providerName: authorIdentity?.displayName || data.providerName || '',
        providerUid: authorIdentity?.uid || data.providerUid || data.createdBy || null,
        authorIdentity,
        woundId: typeof data.woundId === 'string' ? data.woundId : null,
        woundLabel: typeof data.woundLabel === 'string' ? data.woundLabel : null,
      };
    });
  }

  private asIdentity(value: unknown): ClinicalIdentitySnapshot | null {
    if (!value || typeof value !== 'object') return null;
    const candidate = value as Partial<ClinicalIdentitySnapshot>;
    return candidate.uid && candidate.displayName && candidate.orgId
      ? candidate as ClinicalIdentitySnapshot
      : null;
  }
}