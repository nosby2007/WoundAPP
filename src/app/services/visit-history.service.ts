import { Injectable } from '@angular/core';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { FieldRolePolicyService } from './field-role-policy.service';

export interface VisitHistoryItem {
  id: string;
  patientId: string;
  appointmentId?: string | null;
  woundId?: string | null;
  episodeId?: string | null;
  visitType?: string | null;
  status?: string | null;
  appointmentStatus?: string | null;
  scheduledFor?: any;
  completedAt?: any;
  fieldCompletedAt?: any;
  checkIn?: any;
  checkOut?: any;
  clinicianUid?: string | null;
  clinicianName?: string | null;
  clinicianRole?: string | null;
  performedByUid?: string | null;
  performedByName?: string | null;
  performedByRole?: string | null;
  fieldVisitState?: string | null;
  officeDocumentationState?: string | null;
  notDoneReasonCode?: string | null;
  notDoneReason?: string | null;
  notDoneAt?: any;
  summary?: string | null;
  nextStep?: string | null;
  placeOfService?: string | null;
  mobileWorkflow?: any;
  createdAt?: any;
  updatedAt?: any;
}

@Injectable({ providedIn: 'root' })
export class VisitHistoryService {
  constructor(private policy: FieldRolePolicyService) {}

  async listPatientVisits(patientId: string, max = 150): Promise<VisitHistoryItem[]> {
    const identity = await this.policy.currentIdentity();
    if (!this.policy.canSeeVisitHistory(identity)) {
      throw new Error('Visit history is restricted to licensed clinical roles.');
    }

    const q = query(
      collection(db, `patients/${patientId}/woundVisits`),
      orderBy('createdAt', 'desc'),
      limit(max),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, patientId, ...(d.data() as any) } as VisitHistoryItem));
  }

  async getVisit(patientId: string, visitId: string): Promise<VisitHistoryItem | null> {
    const visits = await this.listPatientVisits(patientId, 200);
    return visits.find(v => v.id === visitId) ?? null;
  }

  toDate(value: any): Date | null {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
    if (value instanceof Date) return value;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
}
