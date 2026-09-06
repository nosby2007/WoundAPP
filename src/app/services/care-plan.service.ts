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
import { CarePlanCatalogEntry, CarePlanProblemCategory } from '../shared/care-plan';

/**
 * A care plan for one wound, written from the field.
 *
 * Two documents, exactly as the web app models them:
 *
 *   patients/{pid}/carePlans/{id}                  the plan
 *   patients/{pid}/carePlans/{id}/problems/{pid}   the named problem on it
 *
 * The plan doc is what the web's care plan list renders (title / startDate /
 * workflow state); the goals live on the problem, which is where its detail
 * dialog reads them from. Writing only the plan would produce a row that
 * opens onto nothing.
 *
 * `woundId` is a field the CarePlan model already has and nothing was
 * setting: it is what makes this "the plan for the right heel" rather than
 * "a plan for this patient".
 *
 * THE GOAL WORDING IS NOT IN THIS APP.
 * It comes from organizations/{orgId}/carePlanCatalog, which an org admin
 * authors. The nurse picks from that list, or types a custom goal that is
 * stored as custom -- the same two paths the web editor offers. This app
 * ships no clinical goal text of its own.
 *
 * Built on the plain modular SDK (auth/db from ../firebase) for the reason
 * recorded in a713a49d: mixing injected Auth and Firestore in a
 * root-provided service here produces NG0200.
 */

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
  /** Catalog document ids, in the order the nurse ticked them. */
  goalCatalogRefs: string[];
  /** Free text, one goal per line, for anything not yet in the catalog. */
  customGoals: string[];
}

@Injectable({ providedIn: 'root' })
export class CarePlanService {
  private tenant = inject(TenantService);

  /**
   * The org's admin-authored goals and interventions.
   *
   * Read whole and filtered here rather than queried with three equality
   * clauses. The catalog is a short, admin-curated list, and a query that
   * needs an index this project does not declare fails as an empty
   * catalog -- which looks exactly like "the admin has not written any
   * goals yet" and would send the nurse to type custom text for goals that
   * already exist.
   */
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

  /** Creates the plan and its first problem. Returns the plan's id. */
  async create(patientId: string, draft: CarePlanDraft): Promise<string> {
    if (!patientId) throw new Error('CarePlanService.create(): patientId is missing.');

    const user = auth.currentUser;
    if (!user) throw new NotAuthenticatedError();

    const orgId = await this.tenant.currentOrgId();
    if (!orgId) throw new NoOrgError();

    const actor = await this.actor();
    const now = serverTimestamp();

    const planRef = doc(collection(db, `patients/${patientId}/carePlans`));
    await setDoc(planRef, {
      orgId,
      patientId,
      woundId: draft.woundId ?? null,
      episodeId: null,
      title: draft.title,
      description: draft.description || null,
      startDate: draft.startDate,
      endDate: null,
      // The workflow envelope every new clinical object carries. History
      // entries use a client Timestamp, not serverTimestamp(): arrayUnion
      // and array elements reject the server sentinel, and the web's
      // WorkflowEngineService.initWorkflow() does the same for the same
      // reason.
      workflow: {
        state: 'created',
        history: [{
          toState: 'created',
          fromState: null,
          occurredAt: Timestamp.now(),
          actor,
          comment: 'Care plan created in the field.',
        }],
      },
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
      createdAt: now,
      createdBy: actor,
    });

    return planRef.id;
  }

  /**
   * Who is writing this, in the shape the web's AuditIdentity uses.
   *
   * The role comes from the token claims, which is where the rules read it
   * too -- taking it from anywhere else would let the record disagree with
   * the decision that allowed it. Absent claims give a null role rather than
   * a guessed one.
   */
  private async actor(): Promise<{ uid: string; displayName: string | null; role: string | null }> {
    const user = auth.currentUser!;
    let role: string | null = null;
    try {
      const token = await user.getIdTokenResult();
      const claims = token.claims as Record<string, unknown>;
      const roles = claims['roles'];
      if (Array.isArray(roles) && typeof roles[0] === 'string') role = roles[0];
      else if (typeof claims['role'] === 'string') role = claims['role'] as string;
    } catch {
      role = null;
    }
    return {
      uid: user.uid,
      displayName: user.displayName || user.email || null,
      role,
    };
  }
}
