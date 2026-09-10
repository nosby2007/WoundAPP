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
import { ClinicalIdentityService } from './clinical-identity.service';
import { bradenRiskText, bradenTotal, BradenSubscales, buildBradenAnswers } from '../shared/braden';

/**
 * Non-wound patient assessments stored under patients/{id}/assessments.
 * Braden remains an unsigned recorded assessment unless a real e-sign flow
 * is performed elsewhere; author identity is not a substitute for signature.
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
  private clinicalIdentity = inject(ClinicalIdentityService);

  async createBraden(patientId: string, subscales: BradenSubscales, assessedAt: Date): Promise<string> {
    if (!patientId) throw new Error('PatientAssessmentService.createBraden(): patientId is missing.');
    if (!auth.currentUser) throw new NotAuthenticatedError();

    const orgId = await this.tenant.currentOrgId();
    if (!orgId) throw new Error('Organization context is unavailable.');
    const identity = await this.clinicalIdentity.requireCurrentIdentity();
    const now = serverTimestamp();
    const total = bradenTotal(subscales);

    const payload: Record<string, unknown> = {
      orgId,
      patientId,
      program: 'Braden',
      kind: 'braden',
      status: 'submitted',
      assessedAt,
      score: total,
      answers: {
        braden: buildBradenAnswers(subscales, assessedAt),
        createdAt: assessedAt,
      },
      recordedByUid: identity.uid,
      recordedByName: identity.displayName,
      authorIdentity: identity,
      createdBy: identity,
      createdAt: now,
      updatedAt: now,
    };

    const ref = await addDoc(collection(db, `patients/${patientId}/assessments`), payload);
    return ref.id;
  }

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
          recordedByName: data?.authorIdentity?.displayName || data?.recordedByName || data?.answers?.eSignature?.signerName || '',
        };
      });
  }
}
