import { Injectable } from '@angular/core';
import { collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, Timestamp, updateDoc, where } from 'firebase/firestore';
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
  start: any;
  end?: any;
  status: string;
  completedAt?: any;
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
