import { Injectable, inject } from '@angular/core';
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';

import { auth, db } from '../firebase';
import { TenantService } from './tenant.service';
import { ClinicalIdentityService, ClinicalIdentitySnapshot } from './clinical-identity.service';
import { CarePlanCatalogEntry, CarePlanProblemCategory } from '../shared/care-plan';

export class NotAuthenticatedError extends Error {
  constructor() {
    super('You are signed out. Sign in again to write a care plan.');
    this.name = 'NotAuthenticatedError';
  }
}

export class NoOrgError extends Error {
  constructor() {
    super('Your account has no organization, so a care plan cannot be filed.');
    this.name = 'NoOrgError';
  }
}

export interface CarePlanDraft {
  title: string;
  description?: string | null;
  startDate: string;
  woundId?: string | null;
  category: CarePlanProblemCategory;
  goalCatalogRefs: string[];
  customGoals: string[];
}

/**
 * Patient/wound care plans written from the field.
 *
 * Clinical goal wording comes from the organization's admin-authored
 * organizations/{orgId}/carePlanCatalog. The mobile client carries no
 * hard-coded treatment goals. Custom text is persisted separately so it
 * remains distinguishable from curated organization content.
 *
 * Every newly-authored plan now carries the same canonical users/{uid}
 * clinical identity snapshot as notes, rounds and orders; Auth email aliases
 * are never promoted into a clinician name.
 */
@Injectable({ providedIn: 'root' })
export class CarePlanService {
  private tenant = inject(TenantService);
  private clinicalIdentity = inject(ClinicalIdentityService);

  async listCatalog(): Promise<CarePlanCatalogEntry[]> {
    const orgId = await this.tenant.currentOrgId();
    if (!orgId) return [];

    const snap = await getDocs(collection(db, `organizations/${orgId}/carePlanCatalog`));
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) } as any))
      .filter((item) => item.active !== false && typeof item.text === 'string' && item.text.trim())
      .map((item) => ({
        id: item.id,
        category: String(item.category ?? ''),
        kind: String(item.kind ?? ''),
        text: String(item.text).trim(),
      }));
  }

  async create(patientId: string, draft: CarePlanDraft): Promise<string> {
    if (!patientId) throw new Error('CarePlanService.create(): patientId is missing.');
    if (!auth.currentUser) throw new NotAuthenticatedError();

    const orgId = await this.tenant.currentOrgId();
    if (!orgId) throw new NoOrgError();

    const actor = await this.clinicalIdentity.requireCurrentIdentity();
    this.assertClinicalAuthor(actor);
    const now = serverTimestamp();

    const planRef = doc(collection(db, `patients/${patientId}/carePlans`));
    await setDoc(planRef, {
      orgId,
      patientId,
      woundId: draft.woundId ?? null,
      episodeId: null,
      title: draft.title.trim(),
      description: draft.description?.trim() || null,
      startDate: draft.startDate,
      endDate: null,
      workflow: {
        state: 'created',
        history: [{
          toState: 'created',
          fromState: null,
          occurredAt: Timestamp.now(),
          actor,
          comment: 'Care plan created in the mobile clinical workspace.',
        }],
      },
      authorIdentity: actor,
      createdAt: now,
      updatedAt: now,
      createdBy: actor,
      updatedBy: actor,
    });

    const problemRef = doc(collection(db, `patients/${patientId}/carePlans/${planRef.id}/problems`));
    await setDoc(problemRef, {
      carePlanId: planRef.id,
      patientId,
      orgId,
      category: draft.category,
      goalCatalogRefs: draft.goalCatalogRefs,
      interventionCatalogRefs: [],
      customGoals: draft.customGoals,
      customInterventions: [],
      status: 'active',
      authorIdentity: actor,
      createdAt: now,
      createdBy: actor,
    });

    return planRef.id;
  }

  private assertClinicalAuthor(identity: ClinicalIdentitySnapshot): void {
    const roles = new Set([identity.role, ...(identity.roles || [])].map((r) => String(r || '').toLowerCase()));
    if (![...roles].some((r) => ['provider', 'np', 'nurse', 'rn', 'wound_nurse_internal'].includes(r))) {
      throw new Error('Your role cannot author a patient care plan in the mobile clinical workspace.');
    }
  }
}
