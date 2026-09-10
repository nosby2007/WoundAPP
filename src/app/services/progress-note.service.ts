// src/app/services/progress-note.service.ts
import { Injectable } from '@angular/core';
import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { ClinicalIdentityService, ClinicalIdentitySnapshot } from './clinical-identity.service';
import { ClinicalAuditService } from './clinical-audit.service';

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
      type: 'Progress Notes',
      details: text,
      effectiveAt: now,
      providerName: identity.displayName,
      providerUid: identity.uid,
      authorIdentity: identity,
      createdBy: identity.uid,
      createdAt: now,
      updatedAt: now,
    };

    if (wound) {
      payload['woundId'] = wound.woundId;
      payload['woundAssessmentId'] = wound.woundAssessmentId;
      payload['woundLabel'] = wound.label;
    }

    const ref = await addDoc(collection(db, `patients/${patientId}/providerNotes`), payload);
    await this.audit.record({ action: 'progress_note_created', patientId, entityType: 'providerNote', entityId: ref.id, metadata: { woundLinked: !!wound } });
    return ref.id;
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
