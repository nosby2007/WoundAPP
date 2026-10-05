import { Injectable } from '@angular/core';
import { addDoc, collection, getDocs, onSnapshot, orderBy, query, serverTimestamp, Timestamp, where } from 'firebase/firestore';
import { Observable } from 'rxjs';
import { auth, db } from '../firebase';
import { TenantService } from './tenant.service';

export interface MobileSchedulePatient {
  id: string;
  name: string;
  phone: string;
  address: string;
  facilityId?: string | null;
  patientStatus?: string | null;
}

export interface MobileScheduledVisit {
  id: string;
  orgId: string;
  patientId?: string;
  patientName: string;
  homeAddress?: string;
  patientTelephone?: string;
  appointmentDetails?: string;
  visitType?: string | null;
  assignedToUid: string;
  assignedToName?: string;
  assignedToRole?: string;
  facilityId?: string | null;
  start: any;
  end?: any;
  status: string;
}

@Injectable({ providedIn: 'root' })
export class MobileScheduleService {
  constructor(private tenant: TenantService) {}

  future$(days = 60): Observable<MobileScheduledVisit[]> {
    return new Observable(subscriber => {
      const user = auth.currentUser;
      if (!user) { subscriber.next([]); subscriber.complete(); return; }
      let stop = () => {};
      this.tenant.currentOrgId().then(orgId => {
        if (!orgId) { subscriber.next([]); return; }
        const from = new Date(); from.setMinutes(0, 0, 0);
        const to = new Date(from); to.setDate(to.getDate() + days);
        const q = query(
          collection(db, 'appointments'),
          where('orgId', '==', orgId),
          where('assignedToUid', '==', user.uid),
          where('start', '>=', Timestamp.fromDate(from)),
          where('start', '<', Timestamp.fromDate(to)),
          orderBy('start', 'asc')
        );
        stop = onSnapshot(q, snap => subscriber.next(snap.docs.map(d => ({ id:d.id, ...d.data() } as MobileScheduledVisit))), err => subscriber.error(err));
      }).catch(err => subscriber.error(err));
      return () => stop();
    });
  }

  async patients(): Promise<MobileSchedulePatient[]> {
    const orgId = await this.tenant.currentOrgId();
    if (!orgId) return [];
    const q = query(collection(db, 'patients'), where('orgId', '==', orgId));
    const snap = await getDocs(q);
    return snap.docs
      .map(d => {
        const p: any = d.data();
        const address = p.address || [p.address1, p.address2, p.city, p.state, p.zip].filter(Boolean).join(', ');
        return { id:d.id, name:p.preferredName || p.name || 'Patient', phone:p.phone || p.telephone || '', address:address || '', facilityId:p.facilityId ?? null, patientStatus:p.patientStatus ?? null } as MobileSchedulePatient;
      })
      .filter(p => !p.patientStatus || p.patientStatus === 'active')
      .sort((a,b) => a.name.localeCompare(b.name));
  }

  async planOwnVisit(patient: MobileSchedulePatient, start: Date, durationMinutes: number, details = 'Wound follow-up'): Promise<string> {
    const user = auth.currentUser;
    const orgId = await this.tenant.currentOrgId();
    if (!user || !orgId) throw new Error('Sign in required');
    if (!patient?.id) throw new Error('Choose a patient');
    if (!(start instanceof Date) || Number.isNaN(start.getTime()) || start.getTime() <= Date.now()) throw new Error('Choose a future date and time');
    if (!Number.isFinite(durationMinutes) || durationMinutes < 15 || durationMinutes > 480) throw new Error('Visit duration is invalid');

    const token = await user.getIdTokenResult();
    const role = String(token.claims['role'] || (Array.isArray(token.claims['roles']) ? token.claims['roles'][0] : '') || 'clinician');
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    const ref = await addDoc(collection(db, 'appointments'), {
      orgId,
      facilityId: patient.facilityId ?? null,
      patientId: patient.id,
      patientName: patient.name,
      workflowKind: 'wound',
      appointmentDetails: details.trim() || 'Wound follow-up',
      homeAddress: patient.address,
      patientTelephone: patient.phone,
      assignedToUid: user.uid,
      assignedToName: user.displayName || user.email || 'Clinician',
      assignedToRole: role,
      createdByUid: user.uid,
      start: Timestamp.fromDate(start),
      end: Timestamp.fromDate(end),
      status: 'scheduled',
      statusReason: null,
      visitNote: '',
      completedAt: null,
      completedByUid: null,
      source: 'mobile_self_plan',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  }

  toDate(value: any): Date | null {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
}
