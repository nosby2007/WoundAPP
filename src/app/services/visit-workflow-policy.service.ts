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
    const kind = (visitType || 'follow_up').toLowerCase().replace(/[-\s]+/g, '_');

    if (/admission|initial|new/.test(kind)) {
      return {
        id: 'default-admission',
        visitType: 'admission',
        required: ['visit','assessment','braden','systemic','carePlan','order','education','woundAssessment','progressNote'],
        optional: [],
        active: true,
      };
    }

    if (/np|provider.*evaluation|evaluation.*provider/.test(kind)) {
      return {
        id: 'default-np-evaluation',
        visitType: 'np_evaluation',
        required: ['visit','assessment','systemic','carePlan','order','woundAssessment','progressNote'],
        optional: ['braden','education'],
        active: true,
      };
    }

    if (/round/.test(kind)) {
      return {
        id: 'default-wound-round',
        visitType: 'wound_round',
        required: ['visit','woundAssessment','order','progressNote'],
        optional: ['assessment','braden','systemic','carePlan','education'],
        active: true,
      };
    }

    if (/prn|urgent|unscheduled/.test(kind)) {
      return {
        id: 'default-prn',
        visitType: 'prn',
        required: ['visit','assessment','woundAssessment','progressNote'],
        optional: ['braden','systemic','carePlan','order','education'],
        active: true,
      };
    }

    return {
      id: 'default-follow-up',
      visitType: 'follow_up',
      required: ['visit','woundAssessment','progressNote'],
      optional: ['assessment','braden','systemic','carePlan','order','education'],
      active: true,
    };
  }
}
