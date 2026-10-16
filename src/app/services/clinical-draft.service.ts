import { Injectable } from '@angular/core';
import { httpsCallable } from 'firebase/functions';

import { functions } from '../firebase';

export type ClinicalDraftKind =
  | 'wound_assessment'
  | 'care_plan'
  | 'education'
  | 'clinical_order'
  | 'progress_note'
  | 'telehealth_note'
  | 'telehealth_intake';

export interface ClinicalDraftKey {
  formKind: ClinicalDraftKind;
  patientId: string;
  contextKey: string;
}

export interface ClinicalDraftRecord<T = Record<string, unknown>> {
  payload: T;
  updatedAt: string | null;
  expiresAt: string | null;
}

/**
 * Server-owned draft persistence for resumable mobile documentation.
 *
 * Drafts are scoped to authenticated user + organization + patient + form
 * context. They survive navigation, auth timeout and device reload without
 * storing PHI in localStorage/IndexedDB. Canonical chart records remain
 * separate until the clinician explicitly saves/finalizes the form.
 */
@Injectable({ providedIn: 'root' })
export class ClinicalDraftService {
  async save<T extends Record<string, unknown>>(key: ClinicalDraftKey, payload: T): Promise<void> {
    await this.call('saveClinicalFormDraftV1', { ...key, payload });
  }

  async load<T extends Record<string, unknown>>(key: ClinicalDraftKey): Promise<ClinicalDraftRecord<T> | null> {
    const result = await this.call<{ draft: ClinicalDraftRecord<T> | null }>('getClinicalFormDraftV1', key);
    return result.draft || null;
  }

  async clear(key: ClinicalDraftKey): Promise<void> {
    await this.call('deleteClinicalFormDraftV1', key);
  }

  private async call<T = { ok: true }>(name: string, data: unknown): Promise<T> {
    if (!navigator.onLine) {
      throw new Error('Draft sync requires a connection. Keep this screen open until connectivity returns.');
    }
    return (await httpsCallable<unknown, T>(functions, name)(data)).data;
  }
}
