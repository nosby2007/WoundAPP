import { Injectable } from '@angular/core';
import { collection, doc, getDoc, onSnapshot, orderBy, query, runTransaction, serverTimestamp, Timestamp, updateDoc, where } from 'firebase/firestore';
import { Observable } from 'rxjs';
import { auth, db } from '../firebase';
import { TenantService } from './tenant.service';

export interface FieldPatient {
  id: string;
  name: string;
  address: string;
  phone: string;
  room?: string | null;
  facilityId?: string | null;
}

export interface FieldVisit {
  id: string;
  orgId?: string;
  patientId?: string;
  patientName: string;
  appointmentDetails?: string;
  visitType?: string | null;
  homeAddress?: string;
  patientTelephone?: string;
  assignedToUid?: string;
  assignedToName?: string;
  assignedToRole?: string;
  workflowKind?: 'general' | 'wound';
  woundId?: string | null;
  woundLabel?: string | null;
  woundLocation?: string | null;
  episodeId?: string | null;
  episodeTitle?: string | null;
  facilityId?: string | null;
  start: any;
  end?: any;
  status: string;
  completedAt?: any;
  nextAppointmentId?: string | null;
  patient?: FieldPatient | null;
}

export interface FieldTask {
  id: string;
  orgId?: string;
  patientId: string;
  title: string;
  description?: string;
  dueAt?: any;
  status: string;
  workNote?: string;
  statusReason?: string | null;
  assignedToUid?: string;
  assignedToName?: string;
  completedAt?: any;
  patient?: FieldPatient | null;
}

export interface TodayWork {
  visits: FieldVisit[];
  overdueTasks: FieldTask[];
  dueTodayTasks: FieldTask[];
  completedTodayTasks: FieldTask[];
}

@Injectable({ providedIn: 'root' })
export class FieldWorkService {
  constructor(private tenant: TenantService) {}

  today$(): Observable<TodayWork> {
    return new Observable<TodayWork>(subscriber => {
      const user = auth.currentUser;
      if (!user) { subscriber.next(this.empty()); subscriber.complete(); return; }
      let stopVisits = () => {};
      let stopTasks = () => {};
      let visits: FieldVisit[] = [];
      let tasks: FieldTask[] = [];
      const emit = () => subscriber.next(this.group(visits, tasks));

      this.tenant.currentOrgId().then(orgId => {
        if (!orgId) { subscriber.next(this.empty()); return; }
        const start = new Date(); start.setHours(0, 0, 0, 0);
        const end = new Date(start); end.setDate(end.getDate() + 1);
        const visitQ = query(
          collection(db, 'appointments'),
          where('orgId', '==', orgId),
          where('assignedToUid', '==', user.uid),
          where('start', '>=', Timestamp.fromDate(start)),
          where('start', '<', Timestamp.fromDate(end)),
          orderBy('start', 'asc')
        );
        stopVisits = onSnapshot(visitQ, async snap => {
          visits = await Promise.all(snap.docs.map(async d => ({
            id: d.id,
            ...d.data(),
            patient: await this.patient((d.data() as any).patientId),
          } as FieldVisit)));
          emit();
        }, err => { console.warn('[Today] visits unavailable', err); visits = []; emit(); });

        const taskQ = query(
          collection(db, 'tasks'),
          where('orgId', '==', orgId),
          where('assignedToUid', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        stopTasks = onSnapshot(taskQ, async snap => {
          tasks = await Promise.all(snap.docs.map(async d => ({
            id: d.id,
            ...d.data(),
            patient: await this.patient((d.data() as any).patientId),
          } as FieldTask)));
          emit();
        }, err => { console.warn('[Today] tasks unavailable', err); tasks = []; emit(); });
      }).catch(err => subscriber.error(err));

      return () => { stopVisits(); stopTasks(); };
    });
  }

  /**
   * Reads one field appointment and verifies the mobile caller is the assignee
   * in the same tenant before returning any patient/location context.
   */
  async getVisit(id: string): Promise<FieldVisit | null> {
    const user = auth.currentUser;
    const orgId = await this.tenant.currentOrgId();
    if (!user || !orgId || !id) return null;

    const snap = await getDoc(doc(db, 'appointments', id));
    if (!snap.exists()) return null;
    const data: any = snap.data();
    if (data.orgId !== orgId || data.assignedToUid !== user.uid) return null;

    return {
      id: snap.id,
      ...data,
      patient: await this.patient(data.patientId),
    } as FieldVisit;
  }

  /** Same minimum-necessary boundary for an assigned field task. */
  async getTask(id: string): Promise<FieldTask | null> {
    const user = auth.currentUser;
    const orgId = await this.tenant.currentOrgId();
    if (!user || !orgId || !id) return null;

    const snap = await getDoc(doc(db, 'tasks', id));
    if (!snap.exists()) return null;
    const data: any = snap.data();
    if (data.orgId !== orgId || data.assignedToUid !== user.uid) return null;

    return {
      id: snap.id,
      ...data,
      patient: await this.patient(data.patientId),
    } as FieldTask;
  }

  async completeVisit(id: string): Promise<void> {
    const uid = auth.currentUser?.uid; if (!uid) throw new Error('Sign in required');
    await updateDoc(doc(db, 'appointments', id), {
      status: 'completed',
      completedAt: serverTimestamp(),
      completedByUid: uid,
      updatedAt: serverTimestamp(),
      statusReason: null,
    });
  }

  /**
   * Create the clinician's own next visit after the current appointment is completed.
   *
   * The transaction is intentionally idempotent at the current appointment boundary:
   * once nextAppointmentId is stamped, retries return that id instead of producing a
   * duplicate visit. The caller can only schedule itself; server rules are expected to
   * enforce the same invariant (`assignedToUid == request.auth.uid`).
   */
  async scheduleNextVisit(currentAppointmentId: string, start: Date, durationMinutes = 60): Promise<string> {
    const user = auth.currentUser;
    const orgId = await this.tenant.currentOrgId();
    if (!user || !orgId) throw new Error('Sign in required');
    if (!currentAppointmentId) throw new Error('Current appointment is required');
    if (!(start instanceof Date) || Number.isNaN(start.getTime())) throw new Error('Choose a valid next visit date and time');
    if (start.getTime() <= Date.now()) throw new Error('The next visit must be scheduled in the future');
    if (!Number.isFinite(durationMinutes) || durationMinutes < 15 || durationMinutes > 480) throw new Error('Visit duration is invalid');

    const currentRef = doc(db, 'appointments', currentAppointmentId);
    return runTransaction(db, async transaction => {
      const currentSnap = await transaction.get(currentRef);
      if (!currentSnap.exists()) throw new Error('Current appointment no longer exists');
      const current: any = currentSnap.data();

      if (current.orgId !== orgId || current.assignedToUid !== user.uid) {
        throw new Error('You can only schedule a follow-up for your own assigned visit');
      }
      if (current.status !== 'completed') {
        throw new Error('Complete the current visit before scheduling the next visit');
      }
      if (typeof current.nextAppointmentId === 'string' && current.nextAppointmentId) {
        return current.nextAppointmentId;
      }

      const nextRef = doc(collection(db, 'appointments'));
      const end = new Date(start.getTime() + durationMinutes * 60_000);
      const next: Record<string, unknown> = {
        orgId,
        facilityId: current.facilityId ?? current.patient?.facilityId ?? null,
        patientId: current.patientId ?? null,
        patientName: current.patientName ?? 'Patient',
        workflowKind: current.workflowKind ?? 'general',
        woundId: current.woundId ?? null,
        woundLabel: current.woundLabel ?? null,
        woundLocation: current.woundLocation ?? null,
        episodeId: current.episodeId ?? null,
        episodeTitle: current.episodeTitle ?? null,
        visitType: current.visitType ?? null,
        appointmentDetails: current.appointmentDetails ?? '',
        homeAddress: current.homeAddress ?? '',
        patientTelephone: current.patientTelephone ?? '',
        assignedToUid: user.uid,
        assignedToName: current.assignedToName ?? user.displayName ?? '',
        assignedToRole: current.assignedToRole ?? '',
        createdByUid: user.uid,
        start: Timestamp.fromDate(start),
        end: Timestamp.fromDate(end),
        status: 'scheduled',
        statusReason: null,
        visitNote: '',
        completedAt: null,
        completedByUid: null,
        source: 'field_followup',
        previousAppointmentId: currentAppointmentId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      transaction.set(nextRef, next);
      transaction.update(currentRef, {
        nextAppointmentId: nextRef.id,
        nextVisitScheduledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return nextRef.id;
    });
  }

  async completeTask(id: string, workNote?: string): Promise<void> {
    const uid = auth.currentUser?.uid; if (!uid) throw new Error('Sign in required');
    const patch: Record<string, unknown> = {
      status: 'done',
      completedAt: serverTimestamp(),
      completedByUid: uid,
      updatedAt: serverTimestamp(),
      statusReason: null,
    };
    const note = (workNote ?? '').trim();
    if (note) patch['workNote'] = note;
    await updateDoc(doc(db, 'tasks', id), patch);
  }

  toDate(v: any): Date | null {
    if (!v) return null;
    if (typeof v.toDate === 'function') return v.toDate();
    return v instanceof Date ? v : new Date(v);
  }

  private async patient(patientId?: string): Promise<FieldPatient | null> {
    if (!patientId) return null;
    try {
      const snap = await getDoc(doc(db, 'patients', patientId));
      if (!snap.exists()) return null;
      const p: any = snap.data();
      return {
        id: patientId,
        name: p.name || 'Patient',
        address: p.address || p.homeAddress || '',
        phone: p.phone || p.telephone || '',
        room: p.room ?? p.roomNumber ?? null,
        facilityId: p.facilityId ?? null,
      };
    } catch {
      return null;
    }
  }

  private group(visits: FieldVisit[], tasks: FieldTask[]): TodayWork {
    const start = new Date(); start.setHours(0,0,0,0);
    const end = new Date(start); end.setDate(end.getDate()+1);
    const overdueTasks: FieldTask[] = [], dueTodayTasks: FieldTask[] = [], completedTodayTasks: FieldTask[] = [];
    for (const task of tasks) {
      const due = this.toDate(task.dueAt);
      const completed = this.toDate(task.completedAt);
      if (task.status === 'done') {
        if (completed && completed >= start && completed < end) completedTodayTasks.push(task);
        continue;
      }
      if (due && due < start) overdueTasks.push(task);
      else if (!due || due < end) dueTodayTasks.push(task);
    }
    return { visits, overdueTasks, dueTodayTasks, completedTodayTasks };
  }

  private empty(): TodayWork {
    return { visits: [], overdueTasks: [], dueTodayTasks: [], completedTodayTasks: [] };
  }
}
