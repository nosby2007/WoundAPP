import { Injectable, inject } from '@angular/core';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { VisitWorkflowPolicyService, WorkflowCircle } from './visit-workflow-policy.service';

export interface WorkflowCompletionItem {
  circle: WorkflowCircle;
  required: boolean;
  complete: boolean;
  count: number;
}

export interface WorkflowCompletionResult {
  visitType: string;
  completed: number;
  totalRequired: number;
  missingRequired: WorkflowCircle[];
  items: WorkflowCompletionItem[];
}

@Injectable({ providedIn: 'root' })
export class VisitCompletenessService {
  private policies = inject(VisitWorkflowPolicyService);

  async evaluate(patientId: string, visitType = 'routine', day = new Date()): Promise<WorkflowCompletionResult> {
    const policy = await this.policies.get(visitType);
    const required = new Set(policy.required);
    const circles: WorkflowCircle[] = [
      'visit','assessment','braden','systemic','carePlan','order','education','woundAssessment','progressNote'
    ];

    const [visits, assessments, carePlans, orders, education, wounds, notes] = await Promise.all([
      this.read(`patients/${patientId}/woundVisits`),
      this.read(`patients/${patientId}/assessments`),
      this.read(`patients/${patientId}/carePlans`),
      this.read(`patients/${patientId}/orders`),
      this.read(`patients/${patientId}/educationRecords`),
      this.read(`patients/${patientId}/woundAssessments`),
      this.read(`patients/${patientId}/providerNotes`),
    ]);

    const sameDay = (row: any) => this.isSameLocalDay(this.extractDate(row), day);
    const counts: Record<WorkflowCircle, number> = {
      visit: visits.filter(sameDay).length,
      assessment: assessments.filter((r) => r.kind !== 'braden' && r.kind !== 'systemic_assessment' && sameDay(r)).length,
      braden: assessments.filter((r) => r.kind === 'braden' && sameDay(r)).length,
      systemic: assessments.filter((r) => r.kind === 'systemic_assessment' && sameDay(r)).length,
      carePlan: carePlans.filter(sameDay).length,
      order: orders.filter(sameDay).length,
      education: education.filter(sameDay).length,
      woundAssessment: wounds.filter(sameDay).length,
      progressNote: notes.filter(sameDay).length,
    };

    const items = circles.map((circle) => ({
      circle,
      required: required.has(circle),
      complete: counts[circle] > 0,
      count: counts[circle],
    }));
    const missingRequired = items.filter((x) => x.required && !x.complete).map((x) => x.circle);
    return {
      visitType,
      completed: items.filter((x) => x.required && x.complete).length,
      totalRequired: required.size,
      missingRequired,
      items,
    };
  }

  private async read(path: string): Promise<any[]> {
    try {
      const snap = await getDocs(collection(db, path));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch {
      return [];
    }
  }

  private extractDate(row: any): Date | null {
    for (const key of ['effectiveAt','assessedAt','deliveredAt','orderedAt','createdAt','scheduledFor','updatedAt']) {
      const value = row?.[key];
      if (!value) continue;
      if (typeof value.toDate === 'function') return value.toDate();
      if (value instanceof Date) return value;
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return null;
  }

  private isSameLocalDay(value: Date | null, expected: Date): boolean {
    if (!value) return false;
    return value.getFullYear() === expected.getFullYear()
      && value.getMonth() === expected.getMonth()
      && value.getDate() === expected.getDate();
  }
}
