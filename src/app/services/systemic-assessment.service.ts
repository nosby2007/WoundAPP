import { Injectable, inject } from '@angular/core';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { TenantService } from './tenant.service';
import { ClinicalIdentityService, ClinicalIdentitySnapshot } from './clinical-identity.service';

export interface SystemicAssessmentDraft {
  general?: string | null;
  neurologic?: string | null;
  cardiovascular?: string | null;
  respiratory?: string | null;
  gastrointestinal?: string | null;
  genitourinary?: string | null;
  musculoskeletal?: string | null;
  integumentary?: string | null;
  headToToe?: string | null;
  mentalStatus?: string | null;
  psychological?: string | null;
  pain?: string | null;
  nutritionHydration?: string | null;
  functionalMobility?: string | null;
  safetyRisks?: string | null;
  other?: string | null;
  clinicalSummary?: string | null;
}

@Injectable({ providedIn: 'root' })
export class SystemicAssessmentService {
  private tenant = inject(TenantService);
  private clinicalIdentity = inject(ClinicalIdentityService);

  async create(patientId: string, draft: SystemicAssessmentDraft): Promise<string> {
    if (!patientId) throw new Error('Patient is required.');
    if (!auth.currentUser) throw new Error('Sign in required.');
    const identity = await this.clinicalIdentity.requireCurrentIdentity();
    this.assertClinicalAuthor(identity);
    const orgId = await this.tenant.currentOrgId();
    if (!orgId) throw new Error('Organization context is unavailable.');

    const systems = Object.fromEntries(
      Object.entries(draft)
        .filter(([key]) => key !== 'clinicalSummary')
        .map(([key, value]) => [key, typeof value === 'string' && value.trim() ? value.trim() : null])
    );
    const documented = Object.values(systems).some(value => !!value);
    const summary = draft.clinicalSummary?.trim() || null;
    if (!documented && !summary) throw new Error('Document at least one assessment section or a clinical summary.');

    const ref = await addDoc(collection(db, `patients/${patientId}/assessments`), {
      orgId,
      patientId,
      program: 'Systemic',
      kind: 'systemic_assessment',
      type: 'systemic_assessment',
      status: 'submitted',
      assessedAt: serverTimestamp(),
      answers: { systems, clinicalSummary: summary },
      recordedByUid: identity.uid,
      recordedByName: identity.displayName,
      authorIdentity: identity,
      createdBy: identity,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  }

  private assertClinicalAuthor(identity: ClinicalIdentitySnapshot): void {
    const roles = new Set([identity.role, ...(identity.roles || [])].map(r => String(r || '').toLowerCase()));
    if (![...roles].some(r => ['provider','np','nurse','rn','wound_nurse_internal'].includes(r))) {
      throw new Error('Your role cannot author a systemic patient assessment.');
    }
  }
}
