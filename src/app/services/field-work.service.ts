import { Injectable } from '@angular/core';
import { collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, Timestamp, updateDoc, where } from 'firebase/firestore';
import { Observable } from 'rxjs';
import { auth, db } from '../firebase';
import { TenantService } from './tenant.service';

export interface FieldPatient { id: string; name: string; address: string; phone: string; room?: string | null; }
export interface FieldVisit { id: string; patientId?: string; patientName: string; appointmentDetails?: string; visitType?: string | null; homeAddress?: string; patientTelephone?: string; start: any; end?: any; status: string; patient?: FieldPatient | null; }
export interface FieldTask { id: string; patientId: string; title: string; dueAt?: any; status: string; workNote?: string; completedAt?: any; patient?: FieldPatient | null; }
export interface TodayWork { visits: FieldVisit[]; overdueTasks: FieldTask[]; dueTodayTasks: FieldTask[]; completedTodayTasks: FieldTask[]; }

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
        const visitQ = query(collection(db, 'appointments'), where('orgId', '==', orgId), where('assignedToUid', '==', user.uid), where('start', '>=', Timestamp.fromDate(start)), where('start', '<', Timestamp.fromDate(end)), orderBy('start', 'asc'));
        stopVisits = onSnapshot(visitQ, async snap => {
          visits = await Promise.all(snap.docs.map(async d => ({ id: d.id, ...d.data(), patient: await this.patient((d.data() as any).patientId) } as FieldVisit)));
          emit();
        }, err => { console.warn('[Today] visits unavailable', err); visits = []; emit(); });

        const taskQ = query(collection(db, 'tasks'), where('orgId', '==', orgId), where('assignedToUid', '==', user.uid), orderBy('createdAt', 'desc'));
        stopTasks = onSnapshot(taskQ, async snap => {
          tasks = await Promise.all(snap.docs.map(async d => ({ id: d.id, ...d.data(), patient: await this.patient((d.data() as any).patientId) } as FieldTask)));
          emit();
        }, err => { console.warn('[Today] tasks unavailable', err); tasks = []; emit(); });
      }).catch(err => subscriber.error(err));

      return () => { stopVisits(); stopTasks(); };
    });
  }

  async completeVisit(id: string): Promise<void> {
    const uid = auth.currentUser?.uid; if (!uid) throw new Error('Sign in required');
    await updateDoc(doc(db, 'appointments', id), { status: 'completed', completedAt: serverTimestamp(), completedByUid: uid, updatedAt: serverTimestamp(), statusReason: null });
  }

  async completeTask(id: string): Promise<void> {
    const uid = auth.currentUser?.uid; if (!uid) throw new Error('Sign in required');
    await updateDoc(doc(db, 'tasks', id), { status: 'done', completedAt: serverTimestamp(), completedByUid: uid, updatedAt: serverTimestamp(), statusReason: null });
  }

  toDate(v: any): Date | null { if (!v) return null; if (typeof v.toDate === 'function') return v.toDate(); return v instanceof Date ? v : new Date(v); }

  private async patient(patientId?: string): Promise<FieldPatient | null> {
    if (!patientId) return null;
    try { const snap = await getDoc(doc(db, 'patients', patientId)); if (!snap.exists()) return null; const p: any = snap.data(); return { id: patientId, name: p.name || 'Patient', address: p.address || '', phone: p.phone || '', room: p.room ?? p.roomNumber ?? null }; } catch { return null; }
  }

  private group(visits: FieldVisit[], tasks: FieldTask[]): TodayWork {
    const start = new Date(); start.setHours(0,0,0,0); const end = new Date(start); end.setDate(end.getDate()+1);
    const overdueTasks: FieldTask[] = [], dueTodayTasks: FieldTask[] = [], completedTodayTasks: FieldTask[] = [];
    for (const task of tasks) {
      const due = this.toDate(task.dueAt); const completed = this.toDate(task.completedAt);
      if (task.status === 'done') { if (completed && completed >= start && completed < end) completedTodayTasks.push(task); continue; }
      if (due && due < start) overdueTasks.push(task); else if (!due || due < end) dueTodayTasks.push(task);
    }
    return { visits, overdueTasks, dueTodayTasks, completedTodayTasks };
  }

  private empty(): TodayWork { return { visits: [], overdueTasks: [], dueTodayTasks: [], completedTodayTasks: [] }; }
}
