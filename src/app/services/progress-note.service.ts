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

/**
 * A note the nurse writes at the bedside.
 *
 * It goes into `patients/{patientId}/providerNotes` with
 * `type: 'Progress Notes'` -- the same collection and the same shape the web
 * app's ProviderNoteService writes. That is the point: a note taken in the
 * field shows up in the chart the providers already read, and in the billing
 * supporting-document picker, without anything having to reconcile two
 * formats later.
 *
 * What the rules require of a create (firestore.rules, providerNotes):
 *   - request.resource.data.patientId == patientId
 *   - intakeIsClinicalAuthor()  -- nurse and wound_nurse are both in the list
 *   - requireCreatedAt()        -- createdAt, if present, must be a Timestamp
 *
 * Note that `patientId` is required by the rules but is absent from the
 * ProviderNote interface in the web app's global.model.ts. The web service
 * writes it anyway; so does this one. The interface is what is out of date,
 * not the rule.
 *
 * Built on the plain modular SDK (auth/db from ../firebase) rather than
 * Angular's injected Auth/Firestore, for the reason recorded in a713a49d:
 * this app registers Firebase through both the compat and modular APIs, and
 * mixing injected Auth with injected Firestore in a service here produces
 * NG0200, a circular dependency in DI. patient.service.ts and
 * tenant.service.ts follow the same pattern.
 */

export interface ProgressNote {
  id: string;
  details: string;
  effectiveAt: Date | null;
  providerName: string;
  woundId: string | null;
  woundLabel: string | null;
}

/**
 * Which wound a note is about, when it is about one.
 *
 * A note written from a wound assessment is still an ordinary provider note
 * -- same collection, same shape, rendered by the same web view -- with three
 * extra fields saying what it was written next to. They are additive: a note
 * without them is a patient-level note, which is what every note in this
 * collection was until now.
 */
export interface ProgressNoteWoundContext {
  woundId: string;
  woundAssessmentId: string;
  /** e.g. "Pressure — Right heel". Denormalized so a reader needs one read. */
  label: string;
}

export class NotAuthenticatedError extends Error {
  constructor() {
    super('You are signed out. Sign in again to write a note.');
    this.name = 'NotAuthenticatedError';
  }
}

@Injectable({ providedIn: 'root' })
export class ProgressNoteService {
  /**
   * Appends a progress note to the patient's chart.
   *
   * `effectiveAt` is set here because the web app's list orders by it
   * (`orderBy('effectiveAt', 'desc')`); a note without it would be written
   * successfully and then never appear in the provider's view.
   */
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

    const now = serverTimestamp();

    const payload: Record<string, unknown> = {
      patientId,
      type: 'Progress Notes',
      details: text,
      effectiveAt: now,
      providerName: user.displayName || user.email || 'Clinician',
      providerUid: user.uid,
      createdBy: user.uid,
      createdAt: now,
      updatedAt: now,
    };

    // Only when there is one. An absent woundId means "about the patient",
    // which is not the same statement as "about no wound in particular".
    if (wound) {
      payload['woundId'] = wound.woundId;
      payload['woundAssessmentId'] = wound.woundAssessmentId;
      payload['woundLabel'] = wound.label;
    }

    // The note body is exactly what the clinician typed. The wound is
    // recorded beside it, never prepended to it: a note is a clinician's
    // words, and this app does not add any.
    const ref = await addDoc(collection(db, `patients/${patientId}/providerNotes`), payload);

    return ref.id;
  }

  /** The most recent notes on this patient, newest first. */
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
      return {
        id: d.id,
        details: data.details || '',
        // A note written seconds ago still has a pending serverTimestamp
        // locally, so effectiveAt can be null until the write settles.
        effectiveAt: typeof data.effectiveAt?.toDate === 'function' ? data.effectiveAt.toDate() : null,
        providerName: data.providerName || data.createdBy || '',
        woundId: typeof data.woundId === 'string' ? data.woundId : null,
        woundLabel: typeof data.woundLabel === 'string' ? data.woundLabel : null,
      };
    });
  }
}
