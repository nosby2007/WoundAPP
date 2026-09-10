import { Injectable, inject } from '@angular/core';
import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

import { auth, db } from '../firebase';
import { TenantService } from './tenant.service';
import { EducationDraft, EducationTopicOption } from '../shared/education';
import { ClinicalAuditService } from './clinical-audit.service';

/**
 * Patient and caregiver education, recorded where it happens.
 *
 * Writes patients/{id}/educationRecords -- the same collection and the same
 * shape the web app's EducationRecordService writes, including the workflow
 * envelope every new clinical object in that app carries. A session recorded
 * in the home appears in the chart the providers already read, with nothing
 * to reconcile.
 *
 * The topics come from organizations/{orgId}/educationTopicCatalog, authored
 * by an administrator. This app ships none.
 *
 * Built on the plain modular SDK (auth/db from ../firebase) for the reason
 * recorded in a713a49d: mixing injected Auth and Firestore in a
 * root-provided service here produces NG0200.
 */

export class NotAuthenticatedError extends Error {
  constructor() {
    super('You are signed out. Sign in again to record education.');
    this.name = 'NotAuthenticatedError';
  }
}

export class NoOrgError extends Error {
  constructor() {
    super('Your account has no organization, so education cannot be filed.');
    this.name = 'NoOrgError';
  }
}

export interface EducationRow {
  id: string;
  topic: string;
  deliveredAt: Date | null;
  deliveredByName: string;
  woundId: string | null;
}

@Injectable({ providedIn: 'root' })
export class EducationService {
  private tenant = inject(TenantService);
  private audit = inject(ClinicalAuditService);

  /**
   * The org's topic catalog.
   *
   * Read whole and filtered here rather than queried on category + active. A
   * query needing an index this project does not declare fails as an empty
   * catalog -- indistinguishable from "the admin has not written any topics",
   * which would send the nurse to type a topic that already exists and split
   * the reporting on it.
   */
  async listTopics(): Promise<EducationTopicOption[]> {
    const orgId = await this.tenant.currentOrgId();
    if (!orgId) return [];

    const snap = await getDocs(collection(db, `organizations/${orgId}/educationTopicCatalog`));
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) } as any))
      .filter((item) => item.active !== false && typeof item.topic === 'string' && item.topic.trim())
      .map((item) => ({
        id: item.id as string,
        category: String(item.category ?? '').trim(),
        topic: String(item.topic).trim(),
        instructionText: typeof item.instructionText === 'string' && item.instructionText.trim()
          ? item.instructionText.trim()
          : null,
      }))
      .sort((a, b) => a.category.localeCompare(b.category) || a.topic.localeCompare(b.topic));
  }

  async create(patientId: string, draft: EducationDraft): Promise<string> {
    if (!patientId) throw new Error('EducationService.create(): patientId is missing.');

    const user = auth.currentUser;
    if (!user) throw new NotAuthenticatedError();

    const orgId = await this.tenant.currentOrgId();
    if (!orgId) throw new NoOrgError();

    const actor = {
      uid: user.uid,
      displayName: user.displayName || user.email || null,
      role: null as string | null,
    };
    const now = serverTimestamp();

    const ref = await addDoc(collection(db, `patients/${patientId}/educationRecords`), {
      orgId,
      patientId,
      woundId: draft.woundId ?? null,
      topic: draft.topic.trim(),
      category: draft.category || null,
      learners: draft.learners,
      readiness: draft.readiness,
      method: draft.method,
      response: draft.response,
      deliveredBy: actor,
      // The moment it happened is the server's, not the handset's.
      deliveredAt: now,
      notes: draft.notes || null,
      status: 'active',
      // History entries use a client Timestamp: array elements reject the
      // server sentinel, and the web's WorkflowEngineService.initWorkflow()
      // does the same for the same reason.
      workflow: {
        state: 'created',
        history: [{
          toState: 'created',
          fromState: null,
          occurredAt: Timestamp.now(),
          actor,
          comment: 'Education recorded in the field.',
        }],
      },
      createdAt: now,
      createdBy: actor,
    });

    await this.audit.record({ action: 'education_recorded', patientId, entityType: 'educationRecord', entityId: ref.id, metadata: { learnerCount: draft.learners?.length || 0 } });
    return ref.id;
  }

  /** What this patient has already been taught, newest first. */
  async list(patientId: string, max = 10): Promise<EducationRow[]> {
    if (!patientId) throw new Error('EducationService.list(): patientId is missing.');

    const q = query(
      collection(db, `patients/${patientId}/educationRecords`),
      orderBy('deliveredAt', 'desc'),
      limit(max),
    );
    const snap = await getDocs(q);

    return snap.docs.map((d) => {
      const data: any = d.data();
      return {
        id: d.id,
        topic: data.topic || '',
        // A record written seconds ago still holds a pending serverTimestamp
        // locally, so this can be null until the write settles.
        deliveredAt: typeof data.deliveredAt?.toDate === 'function' ? data.deliveredAt.toDate() : null,
        deliveredByName: data.deliveredBy?.displayName || '',
        woundId: typeof data.woundId === 'string' ? data.woundId : null,
      };
    });
  }
}
