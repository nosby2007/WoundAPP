import { Injectable } from '@angular/core';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { TenantService } from './tenant.service';

export interface TeamScheduleVisit {
  id: string;
  patientId?: string | null;
  patientName?: string | null;
  start?: any;
  end?: any;
  status?: string | null;
  statusReason?: string | null;
  assignedToUid?: string | null;
  assignedToName?: string | null;
  assignedToRole?: string | null;
  visitType?: string | null;
  workflowKind?: string | null;
  woundVisitId?: string | null;
  facilityId?: string | null;
}

@Injectable({ providedIn: 'root' })
export class MobileSchedulerService {
  constructor(private tenant: TenantService) {}

  async upcoming(days = 14): Promise<TeamScheduleVisit[]> {
    const orgId = await this.tenant.currentOrgId();
    if (!orgId) throw new Error('Organization context is required.');

    const snap = await getDocs(query(
      collection(db, 'appointments'),
      where('orgId', '==', orgId),
    ));

    const now = Date.now();
    const until = now + Math.max(1, days) * 24 * 60 * 60 * 1000;
    return snap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) } as TeamScheduleVisit))
      .filter(item => {
        const time = this.toDate(item.start)?.getTime() ?? 0;
        return time >= now - 12 * 60 * 60 * 1000 && time <= until;
      })
      .sort((a, b) => (this.toDate(a.start)?.getTime() ?? 0) - (this.toDate(b.start)?.getTime() ?? 0));
  }

  toDate(value: any): Date | null {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
}
