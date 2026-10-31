import { Injectable, inject } from '@angular/core';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';

import { auth, db } from '../firebase';
import { TenantService } from './tenant.service';
import { ClinicalIdentityService, ClinicalIdentitySnapshot } from './clinical-identity.service';
import { CarePlanCatalogEntry, CarePlanProblemCategory, isActiveCarePlan, carePlanIsLocked, carePlanEditFingerprint } from '../shared/care-plan';
import { ClinicalAuditService } from './clinical-audit.service';
import { ClinicalVisitLink, clinicalVisitLinkFields } from '../shared/clinical-visit-link';

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

export interface CarePlanRow {
  id: string;
  title: string;
  description?: string | null;
  woundId?: string | null;
  episodeId?: string | null;
  startDate: string;
  locked?: boolean;
  esign?: { signed?: boolean };
  workflow?: { state?: string };
}
export interface CarePlanEdit {
  id: string;
  problemId: string;
  fingerprint: string;
  draft: CarePlanDraft;
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
  private audit = inject(ClinicalAuditService);

  async listActive(patientId: string, woundId: string | null, episodeId?: string | null): Promise<CarePlanRow[]> {
    if (!patientId) throw new Error('Patient is required.');
    const orgId = await this.tenant.currentOrgId();
    if (!orgId) throw new NoOrgError();
    const snap = await getDocs(collection(db, `patients/${patientId}/carePlans`));
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as any))
      .filter(p => p.orgId === orgId && isActiveCarePlan(p) &&
        (p.woundId || null) === (woundId || null) && (!episodeId || !p.episodeId || p.episodeId === episodeId))
      .sort((a, b) => String(b.startDate || '').localeCompare(String(a.startDate || '')));
  }

  async continuePlan(patientId: string, planId: string, link: ClinicalVisitLink): Promise<void> {
    const plans = await this.listActive(patientId, link.woundId || null, link.episodeId);
    if (!plans.some(p => p.id === planId)) throw new Error('This plan is no longer active for this wound. Reload and review.');
    await this.audit.record({ action: 'care_plan_reviewed_unchanged', patientId, entityType: 'carePlan', entityId: planId,
      metadata: { visitId: link.visitId || null, woundId: link.woundId || null } });
  }

  async details(patientId: string, planId: string): Promise<{ goals: string[]; interventions: string[] }> {
    const [plan, problems, interventions, catalog] = await Promise.all([
      getDoc(doc(db, `patients/${patientId}/carePlans/${planId}`)),
      getDocs(collection(db, `patients/${patientId}/carePlans/${planId}/problems`)),
      getDocs(collection(db, `patients/${patientId}/carePlans/${planId}/interventions`)), this.listCatalog(),
    ]);
    const text = (id: string) => catalog.find(c => c.id === id)?.text || `Catalog reference: ${id} (text unavailable)`;
    const goals: string[] = Array.isArray(plan.data()?.['goals']) ? plan.data()!['goals'] : [];
    const actions: string[] = [];
    for (const row of problems.docs) {
      const p = row.data();
      if (p['status'] === 'resolved') continue;
      goals.push(...(p['goalCatalogRefs'] || []).map(text), ...(p['customGoals'] || []),
        ...Object.values(p['goals'] || {}).map((g: any) => `${g.text} (${g.status || 'status not recorded'})`));
      actions.push(...(p['interventionCatalogRefs'] || []).map(text), ...(p['customInterventions'] || []));
    }
    for (const row of interventions.docs) {
      const i = row.data();
      if (!['archived', 'completed', 'cancelled'].includes(i['workflow']?.state) && i['description']) actions.push(i['description']);
    }
    return { goals, interventions: actions };
  }

  async loadForEdit(patientId: string, planId: string, woundId: string | null): Promise<CarePlanEdit> {
    const orgId = await this.tenant.currentOrgId();
    const actor = await this.clinicalIdentity.requireCurrentIdentity();
    this.assertPlanEditor(actor);
    const plan = (await getDoc(doc(db, `patients/${patientId}/carePlans/${planId}`))).data();
    this.assertEditablePlan(plan, patientId, orgId, woundId);
    const problems = await getDocs(collection(db, `patients/${patientId}/carePlans/${planId}/problems`));
    if (problems.size !== 1) throw new Error('This plan contains multiple or legacy problems. Use its full clinical editor to preserve every problem and intervention.');
    const problem = problems.docs[0].data();
    if (Object.keys(problem['goals'] || {}).length || plan?.['goals']?.length) {
      throw new Error('This plan uses tracked or legacy goals. Use its full clinical editor to preserve goal progress.');
    }
    if (problem['orgId'] !== orgId || problem['patientId'] !== patientId || problem['status'] !== 'active') {
      throw new Error('The plan problem is not available for editing.');
    }
    return { id: planId, problemId: problems.docs[0].id, fingerprint: carePlanEditFingerprint(plan, problem), draft: {
      title: plan!['title'], description: plan!['description'] || null, startDate: plan!['startDate'], woundId,
      category: problem['category'], goalCatalogRefs: problem['goalCatalogRefs'] || [], customGoals: problem['customGoals'] || [],
    } };
  }

  async updateExisting(patientId: string, edit: CarePlanEdit, draft: CarePlanDraft, reason: string): Promise<void> {
    if (!auth.currentUser) throw new NotAuthenticatedError();
    const orgId = await this.tenant.currentOrgId();
    const actor = await this.clinicalIdentity.requireCurrentIdentity();
    this.assertPlanEditor(actor);
    if (actor.uid !== auth.currentUser.uid || !orgId) throw new Error('Clinical identity is unavailable.');
    if (reason.trim().length < 5) throw new Error('Explain the care-plan change.');
    if (!draft.title.trim() || !draft.startDate || !draft.category || (!draft.customGoals.length && !draft.goalCatalogRefs.length)) throw new Error('Complete the care plan and goals.');
    const ref = doc(db, `patients/${patientId}/carePlans/${edit.id}`);
    const problemRef = doc(db, `patients/${patientId}/carePlans/${edit.id}/problems/${edit.problemId}`);
    const auditRef = doc(collection(db, 'clinicalAuditEvents'));
    await runTransaction(db, async tx => {
      const plan = (await tx.get(ref)).data();
      const problem = (await tx.get(problemRef)).data();
      this.assertEditablePlan(plan, patientId, orgId, draft.woundId || null);
      if (!problem || problem['orgId'] !== orgId || problem['patientId'] !== patientId ||
          problem['status'] !== 'active' || carePlanEditFingerprint(plan, problem) !== edit.fingerprint) {
        throw new Error('The care plan changed. Reload before editing.');
      }
      const next = { title: draft.title.trim(), description: draft.description?.trim() || null, startDate: draft.startDate };
      const goals = { category: draft.category, goalCatalogRefs: draft.goalCatalogRefs, customGoals: draft.customGoals };
      if (carePlanEditFingerprint({ ...plan, ...next }, { ...problem, ...goals }) === edit.fingerprint) {
        throw new Error('No care-plan change. Continue the existing plan instead.');
      }
      const now = serverTimestamp();
      tx.update(ref, { ...next, revisionNumber: (plan!['revisionNumber'] || 1) + 1,
        lastEditReason: reason.trim(), lastEditedAt: now, lastEditedBy: actor, lastEditAuditCode: auditRef.id,
        updatedAt: now, updatedBy: actor });
      tx.update(problemRef, { ...goals, updatedAt: now, updatedBy: actor });
      tx.set(auditRef, { orgId, actorUid: actor.uid, patientId, entityType: 'carePlan', entityId: edit.id,
        action: 'care_plan_updated', occurredAt: now, outcome: 'success',
        metadata: { actorRole: actor.role, reason: reason.trim(), before: edit.fingerprint,
          after: carePlanEditFingerprint({ ...plan, ...next }, { ...problem, ...goals }) }, client: { platform: 'woundapp' } });
    });
  }

  private assertPlanEditor(actor: ClinicalIdentitySnapshot): void {
    if (!['provider', 'np'].includes(actor.role.toLowerCase())) throw new Error('A prescriber must modify an existing care plan.');
  }
  private assertEditablePlan(plan: any, patientId: string, orgId: string | null, woundId: string | null): void {
    if (!orgId || !plan || plan.orgId !== orgId || plan.patientId !== patientId ||
        (plan.woundId || null) !== woundId || !isActiveCarePlan(plan)) throw new Error('Care plan is unavailable for this wound.');
    if (carePlanIsLocked(plan)) throw new Error('This signed care plan is read-only. An authorized clinical amendment is required; it will not be overwritten.');
  }

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

  async create(patientId: string, draft: CarePlanDraft, visitLink: ClinicalVisitLink = {}): Promise<string> {
    if (!patientId) throw new Error('CarePlanService.create(): patientId is missing.');
    if (!auth.currentUser) throw new NotAuthenticatedError();

    const orgId = await this.tenant.currentOrgId();
    if (!orgId) throw new NoOrgError();

    const actor = await this.clinicalIdentity.requireCurrentIdentity();
    this.assertClinicalAuthor(actor);
    const now = serverTimestamp();

    const planRef = doc(collection(db, `patients/${patientId}/carePlans`));
    const batch = writeBatch(db);
    batch.set(planRef, {
      orgId,
      patientId,
      ...clinicalVisitLinkFields({
        ...visitLink,
        woundId: draft.woundId ?? visitLink.woundId ?? null,
      }),
      woundId: draft.woundId ?? visitLink.woundId ?? null,
      episodeId: visitLink.episodeId ?? null,
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
    batch.set(problemRef, {
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

    const auditRef = doc(collection(db, 'clinicalAuditEvents'));
    batch.set(auditRef, { orgId, actorUid: actor.uid, patientId, entityType: 'carePlan', entityId: planRef.id,
      action: 'care_plan_created', occurredAt: now, outcome: 'success', metadata: { category: draft.category }, client: { platform: 'woundapp' } });
    await batch.commit();
    return planRef.id;
  }

  private assertClinicalAuthor(identity: ClinicalIdentitySnapshot): void {
    const roles = new Set([identity.role, ...(identity.roles || [])].map((r) => String(r || '').toLowerCase()));
    if (![...roles].some((r) => ['provider', 'np', 'nurse', 'rn', 'wound_nurse_internal'].includes(r))) {
      throw new Error('Your role cannot author a patient care plan in the mobile clinical workspace.');
    }
  }
}
