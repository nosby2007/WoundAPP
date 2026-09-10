import { Injectable, inject } from '@angular/core';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { TenantService } from './tenant.service';

export type WorkflowCircle =
  | 'visit'
  | 'assessment'
  | 'braden'
  | 'systemic'
  | 'carePlan'
  | 'order'
  | 'education'
  | 'woundAssessment'
  | 'progressNote';

export interface MobileWorkflowPolicy {
  id: string;
  visitType: string;
  required: WorkflowCircle[];
  optional: WorkflowCircle[];
  active: boolean;
}

@Injectable({ providedIn: 'root' })
export class VisitWorkflowPolicyService {
  private tenant = inject(TenantService);

  async get(visitType = 'routine'): Promise<MobileWorkflowPolicy> {
    const orgId = await this.tenant.currentOrgId();
    if (!orgId) return this.defaultPolicy(visitType);

    const normalized = (visitType || 'routine').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const snap = await getDoc(doc(db, `organizations/${orgId}/mobileWorkflowPolicies/${normalized}`));
    if (!snap.exists()) return this.defaultPolicy(visitType);

    const data: any = snap.data();
    const valid = new Set<WorkflowCircle>([
      'visit','assessment','braden','systemic','carePlan','order','education','woundAssessment','progressNote'
    ]);
    const required = (Array.isArray(data.required) ? data.required : []).filter((x: any): x is WorkflowCircle => valid.has(x));
    const optional = (Array.isArray(data.optional) ? data.optional : []).filter((x: any): x is WorkflowCircle => valid.has(x));

    return {
      id: snap.id,
      visitType,
      required,
      optional,
      active: data.active !== false,
    };
  }

  private defaultPolicy(visitType: string): MobileWorkflowPolicy {
    const kind = (visitType || 'routine').toLowerCase();
    if (/admission|initial|new/.test(kind)) {
      return {
        id: 'default-admission',
        visitType,
        required: ['visit','assessment','braden','systemic','carePlan','order','education','woundAssessment','progressNote'],
        optional: [],
        active: true,
      };
    }
    return {
      id: 'default-routine',
      visitType,
      required: ['visit','woundAssessment','progressNote'],
      optional: ['braden','systemic','carePlan','order','education','assessment'],
      active: true,
    };
  }
}
