import { Injectable } from '@angular/core';
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, Timestamp, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { TenantService } from './tenant.service';

export interface SchedulerStaffOption {
  uid: string;
  displayName: string;
  role: string;
}

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
  nextAppointmentId?: string | null;
  createdByUid?: string | null;
}

@Injectable({ providedIn: 'root' })
export class MobileSchedulerService {
  constructor(private tenant: TenantService) {}

  async listAssignableStaff(): Promise<SchedulerStaffOption[]> {
    const orgId = await this.tenant.currentOrgId();
    if (!orgId) throw new Error('Organization context is required.');

    const snap = await getDocs(query(
      collection(db, 'staffPublic'),
      where('orgId', '==', orgId),
    ));

    const allowed = new Set([
      'rn', 'registered_nurse', 'nurse', 'wound_nurse', 'wound_nurse_internal',
      'lpn', 'lvn', 'np', 'provider', 'md', 'do', 'physician',
      'cna', 'caregiver', 'personal_care_aide', 'companion', 'sitter',
      'home_health_aide', 'hha',
    ]);

    return snap.docs
      .map(d => {
        const data: any = d.data();
        return {
          uid: d.id,
          displayName: String(data.displayName || data.name || data.email || 'Unnamed'),
          role: this.normalizeRole(data.role),
          status: String(data.status || (data.active === false ? 'inactive' : 'active')).toLowerCase(),
        };
      })
      .filter(item => item.status === 'active' && allowed.has(item.role))
      .map(({ uid, displayName, role }) => ({ uid, displayName, role }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  async createAppointment(input: {
    patientId: string;
    patientName: string;
    assignedToUid: string;
    assignedToName: string;
    assignedToRole: string;
    start: Date;
    end: Date;
    visitType?: string | null;
    workflowKind?: 'general' | 'wound';
    statusReason?: string | null;
    sourceAppointmentId?: string | null;
  }): Promise<string> {
    const user = auth.currentUser;
    const orgId = await this.tenant.currentOrgId();
    if (!user || !orgId) throw new Error('Sign in required.');
    if (!input.patientId) throw new Error('Choose a patient.');
    if (!input.assignedToUid) throw new Error('Assign a staff member.');
    this.validateTimes(input.start, input.end);

    const appointmentRef = doc(collection(db, 'appointments'));
    const facilityId = await this.currentPrimaryFacilityId();
    await setDoc(appointmentRef, {
      orgId,
      facilityId,
      patientId: input.patientId,
      patientName: input.patientName,
      workflowKind: input.workflowKind || 'general',
      visitType: input.visitType || null,
      assignedToUid: input.assignedToUid,
      assignedToName: input.assignedToName,
      assignedToRole: input.assignedToRole,
      createdByUid: user.uid,
      start: Timestamp.fromDate(input.start),
      end: Timestamp.fromDate(input.end),
      status: 'scheduled',
      statusReason: null,
      visitNote: '',
      completedAt: null,
      completedByUid: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (input.sourceAppointmentId) {
      await updateDoc(doc(db, 'appointments', input.sourceAppointmentId), {
        nextAppointmentId: appointmentRef.id,
        updatedAt: serverTimestamp(),
      });
    }
    return appointmentRef.id;
  }

  async updateScheduledAppointment(
    appointmentId: string,
    input: {
      assignedToUid: string;
      assignedToName: string;
      assignedToRole: string;
      start: Date;
      end: Date;
      visitType?: string | null;
    }
  ): Promise<void> {
    this.validateTimes(input.start, input.end);
    const ref = doc(db, 'appointments', appointmentId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Appointment no longer exists.');
    const current: any = snap.data();
    if (current.status !== 'scheduled') {
      throw new Error('Only scheduled appointments can be edited. Create a follow-up visit instead.');
    }

    await updateDoc(ref, {
      assignedToUid: input.assignedToUid,
      assignedToName: input.assignedToName,
      assignedToRole: input.assignedToRole,
      start: Timestamp.fromDate(input.start),
      end: Timestamp.fromDate(input.end),
      visitType: input.visitType || current.visitType || null,
      statusReason: null,
      updatedAt: serverTimestamp(),
    });

    // Keep the pre-created shared wound encounter aligned without granting
    // the scheduler access to any clinical assessment content. Firestore
    // allows only these scheduling fields while the field visit is still
    // untouched (no check-in / scheduled state).
    if (current.patientId && current.woundVisitId) {
      await updateDoc(
        doc(db, `patients/${current.patientId}/woundVisits/${current.woundVisitId}`),
        {
          scheduledFor: Timestamp.fromDate(input.start),
          visitType: input.visitType || current.visitType || null,
          clinicianUid: input.assignedToUid,
          clinicianName: input.assignedToName,
          clinicianRole: input.assignedToRole,
          appointmentStatus: 'scheduled',
          updatedAt: serverTimestamp(),
          updatedBy: auth.currentUser?.uid || null,
        }
      );
    }
  }

  private async currentPrimaryFacilityId(): Promise<string | null> {
    const user = auth.currentUser;
    if (!user) return null;
    try {
      const token = await user.getIdTokenResult();
      const fromClaim = token.claims['primaryFacilityId'];
      if (typeof fromClaim === 'string' && fromClaim.trim()) return fromClaim.trim();
    } catch {}
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      const value = snap.exists() ? (snap.data() as any).primaryFacilityId : null;
      return typeof value === 'string' && value.trim() ? value.trim() : null;
    } catch {
      return null;
    }
  }

  private validateTimes(start: Date, end: Date): void {
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
      throw new Error('Appointment end must be after start.');
    }
  }

  private normalizeRole(value: unknown): string {
    return String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  }

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
