import { Injectable, inject } from '@angular/core';
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
import { TenantService } from './tenant.service';
import { bradenRiskText, bradenTotal, BradenSubscales, buildBradenAnswers } from '../shared/braden';

/**
 * Non-wound assessments: the ones filed under `patients/{id}/assessments`.
 *
 * This is the collection the web app's own AssessmentsService writes and its
 * Braden list reads. The shape below is that service's `add()` wrapper,
 * field for field:
 *
 *   program    'Braden' | 'FallRisk' | 'Nutrition' | 'Wound'   (toProgramFromType)
 *   kind       the narrower type the list queries on ('braden')
 *   answers    everything except `type`, so `answers.braden` holds the scale
 *   assessedAt data.braden.date
 *   status     'submitted'
 *
 * NO eSIGNATURE IS WRITTEN.
 * The web dialog attaches one only after re-authenticating the clinician with
 * their password; that re-auth is what makes the stored object a signature.
 * This app has no such step, so writing the same object would assert a
 * signature nobody gave. `recordedByUid`/`recordedByName` say who typed it,
 * which is true, and the Braden list renders an unsigned row with a blank
 * signer rather than a false name.
 *
 * Built on the plain modular SDK (auth/db from ../firebase) rather than
 * Angular's injected Auth/Firestore, for the reason recorded in a713a49d:
 * mixing injected Auth with injected Firestore in a root-provided service
 * here produces NG0200. progress-note.service.ts and tenant.service.ts follow
 * the same pattern.
 */

export interface BradenRow {
  id: string;
  total: number;
  riskText: string;
  assessedAt: Date | null;
  recordedByName: string;
}

export class NotAuthenticatedError extends Error {
  constructor() {
    super('You are signed out. Sign in again to record an assessment.');
    this.name = 'NotAuthenticatedError';
  }
}

@Injectable({ providedIn: 'root' })
export class PatientAssessmentService {
  private tenant = inject(TenantService);

  /**
   * Files a Braden Scale score.
   *
   * The rules on patients/{id}/assessments require `patientId` on the
   * document and a Timestamp `createdAt` (requireCreatedAt). `orgId` is
   * stamped when the caller has one -- legacy assessments carry none, which
   * is why intakeCanAccessPatientOrLegacy() tolerates its absence, but a new
   * record should not add to that pile.
   */
  async createBraden(patientId: string, subscales: BradenSubscales, assessedAt: Date): Promise<string> {
    if (!patientId) throw new Error('PatientAssessmentService.createBraden(): patientId is missing.');

    const user = auth.currentUser;
    if (!user) throw new NotAuthenticatedError();

    const orgId = await this.tenant.currentOrgId();
    const now = serverTimestamp();
    const total = bradenTotal(subscales);

    const payload: Record<string, unknown> = {
      patientId,
      program: 'Braden',
      kind: 'braden',
      status: 'submitted',
      assessedAt,
      score: total,
      answers: {
        braden: buildBradenAnswers(subscales, assessedAt),
        // The web's add() carries the dialog's own createdAt into answers.
        createdAt: assessedAt,
      },
      recordedByUid: user.uid,
      recordedByName: user.displayName || user.email || 'Clinician',
      createdBy: user.uid,
      createdAt: now,
      updatedAt: now,
    };
    if (orgId) payload['orgId'] = orgId;

    const ref = await addDoc(collection(db, `patients/${patientId}/assessments`), payload);
    return ref.id;
  }

  /**
   * The patient's recent Braden scores, newest first.
   *
   * NO `where('kind', ...)` CLAUSE, DELIBERATELY.
   * An equality filter combined with an orderBy on a different field needs a
   * composite index, and this project's firestore.indexes.json declares none
   * for `assessments` -- the web app's own Braden list carries exactly that
   * query and swallows the resulting FAILED_PRECONDITION into an empty list.
   * A phone showing "no Braden scores" because of a missing index, seconds
   * after the nurse recorded one, is the worst possible answer. Ordering on a
   * single field uses the automatic index, so this cannot fail that way; the
   * kind filter happens below, on a handful of documents.
   *
   * The total is recomputed from the stored subscales, as the web list also
   * does -- a stored total that disagrees with its own parts is the one
   * number nobody would notice being wrong.
   */
  async listBraden(patientId: string, max = 10): Promise<BradenRow[]> {
    if (!patientId) throw new Error('PatientAssessmentService.listBraden(): patientId is missing.');

    const q = query(
      collection(db, `patients/${patientId}/assessments`),
      orderBy('assessedAt', 'desc'),
      limit(Math.max(max * 4, 40)),
    );
    const snap = await getDocs(q);

    return snap.docs
      .filter((d) => (d.data() as any)?.kind === 'braden')
      .slice(0, max)
      .map((d) => {
        const data: any = d.data();
        const braden = data?.answers?.braden ?? data?.braden ?? {};
        const total = bradenTotal(braden);
        return {
          id: d.id,
          total,
          riskText: bradenRiskText(total),
          assessedAt: typeof data?.assessedAt?.toDate === 'function'
            ? data.assessedAt.toDate()
            : data?.assessedAt instanceof Date
              ? data.assessedAt
              : null,
          recordedByName: data?.recordedByName || data?.answers?.eSignature?.signerName || '',
        };
      });
  }
}
