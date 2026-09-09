import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { Observable, combineLatest, of } from 'rxjs';
import { catchError, map, shareReplay, switchMap, take } from 'rxjs/operators';

import { TenantService } from './tenant.service';

export type MobileAppointmentStatus = 'scheduled' | 'completed' | 'not_done' | 'canceled';
export type MobileTaskStatus = 'open' | 'done' | 'not_done';

export interface FieldPatientSummary {
  id: string;
  name: string;
  address: string;
  phone: string;
  facilityId?: string | null;
  room?: string | null;
}

export interface FieldVisit {
  id: string;
  orgId: string;
  patientId?: string;
  patientName: string;
  appointmentDetails?: string;
  visitType?: string | null;
  homeAddress?: string;
  patientTelephone?: string;
  facilityId?: string | null;
  assignedToUid: string;
  assignedToName?: string;
  start: any;
  end?: any;
  status: MobileAppointmentStatus;
  statusReason?: string | null;
  visitNote?: string;
  patient?: FieldPatientSummary | null;
}

export interface FieldTask {
  id: string;
  orgId: string;
  patientId: string;
  title: string;
  status: MobileTaskStatus;
  assignedToUid?: string | null;
  dueAt?: any;
  workNote?: string;
  statusReason?: string | null;
  createdAt?: any;
  completedAt?: any;
  patient?: FieldPatientSummary | null;
}

export interface TodayFieldWork {
  uid: string;
  visits: FieldVisit[];
  overdueTasks: FieldTask[];
  dueTodayTasks: FieldTask[];
  completedTodayTasks: FieldTask[];
}

@Injectable({ providedIn: 'root' })
export class FieldWorkService {
  readonly today$: Observable<TodayFieldWork>;

  constructor(
    private afs: AngularFirestore,
    private afAuth: AngularFireAuth,
    private tenant: TenantService,
  ) {
    this.today$ = combineLatest([this.afAuth.authState, this.tenant.orgId$]).pipe(
      switchMap(([user, orgId]) => {
        if (!user || !orgId) {
          return of({ uid: '', visits: [], overdueTasks: [], dueTodayTasks: [], completedTodayTasks: [] });
        }
        return combineLatest([
          this.listTodayVisits$(orgId, user.uid),
          this.listMyTasks$(orgId, user.uid),
        ]).pipe(map(([visits, tasks]) => this.buildToday(user.uid, visits, tasks)));
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  async completeVisit(visitId: string, note = ''): Promise<void> {
    const user = await this.afAuth.currentUser;
    if (!user) throw new Error('You must be signed in.');
    await this.afs.doc(`appointments/${visitId}`).update({
      status: 'completed', statusReason: null, visitNote: note,
      completedAt: firebase.firestore.FieldValue.serverTimestamp(),
      completedByUid: user.uid,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }

  async markVisitNotDone(visitId: string, reason: string): Promise<void> {
    const user = await this.afAuth.currentUser;
    if (!user) throw new Error('You must be signed in.');
    await this.afs.doc(`appointments/${visitId}`).update({
      status: 'not_done', statusReason: reason || 'Not done',
      completedAt: firebase.firestore.FieldValue.serverTimestamp(),
      completedByUid: user.uid,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }

  async completeTask(taskId: string, workNote = ''): Promise<void> {
    const user = await this.afAuth.currentUser;
    if (!user) throw new Error('You must be signed in.');
    await this.afs.doc(`tasks/${taskId}`).update({
      status: 'done', statusReason: null, workNote,
      completedAt: firebase.firestore.FieldValue.serverTimestamp(),
      completedByUid: user.uid,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }

  async markTaskNotDone(taskId: string, reason: string): Promise<void> {
    const user = await this.afAuth.currentUser;
    if (!user) throw new Error('You must be signed in.');
    await this.afs.doc(`tasks/${taskId}`).update({
      status: 'not_done', statusReason: reason || 'Not done',
      completedAt: firebase.firestore.FieldValue.serverTimestamp(),
      completedByUid: user.uid,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }

  private listTodayVisits$(orgId: string, uid: string): Observable<FieldVisit[]> {
    const { start, end } = this.dayBounds(new Date());
    return this.afs.collection<FieldVisit>('appointments', ref =>
      ref.where('orgId', '==', orgId)
        .where('assignedToUid', '==', uid)
        .where('start', '>=', firebase.firestore.Timestamp.fromDate(start))
        .where('start', '<', firebase.firestore.Timestamp.fromDate(end))
        .orderBy('start', 'asc')
    ).snapshotChanges().pipe(
      map(snaps => snaps.map(s => ({ id: s.payload.doc.id, ...(s.payload.doc.data() as FieldVisit) }))),
      switchMap(visits => this.enrichVisits$(visits)),
      catchError(error => {
        console.warn('[FieldWork] Unable to load assigned visits.', error);
        return of([] as FieldVisit[]);
      }),
    );
  }

  private listMyTasks$(orgId: string, uid: string): Observable<FieldTask[]> {
    return combineLatest([
      this.listTasksByStatus$(orgId, uid, 'open'),
      this.listTasksByStatus$(orgId, uid, 'done'),
      this.listTasksByStatus$(orgId, uid, 'not_done'),
    ]).pipe(
      map(([open, done, notDone]) => [...open, ...done, ...notDone]),
      switchMap(tasks => this.enrichTasks$(tasks)),
      catchError(error => {
        console.warn('[FieldWork] Unable to load assigned tasks.', error);
        return of([] as FieldTask[]);
      }),
    );
  }

  private listTasksByStatus$(orgId: string, uid: string, status: MobileTaskStatus): Observable<FieldTask[]> {
    return this.afs.collection<FieldTask>('tasks', ref =>
      ref.where('orgId', '==', orgId)
        .where('assignedToUid', '==', uid)
        .where('status', '==', status)
        .orderBy('createdAt', 'desc')
        .limit(100)
    ).snapshotChanges().pipe(
      map(snaps => snaps.map(s => ({ id: s.payload.doc.id, ...(s.payload.doc.data() as FieldTask) }))),
    );
  }

  private enrichVisits$(items: FieldVisit[]): Observable<FieldVisit[]> {
    if (!items.length) return of([]);
    return combineLatest(items.map(item => this.patient$(item.patientId).pipe(map(patient => ({ ...item, patient })))));
  }

  private enrichTasks$(items: FieldTask[]): Observable<FieldTask[]> {
    if (!items.length) return of([]);
    return combineLatest(items.map(item => this.patient$(item.patientId).pipe(map(patient => ({ ...item, patient })))));
  }

  private patient$(patientId?: string | null): Observable<FieldPatientSummary | null> {
    if (!patientId) return of(null);
    return this.afs.doc<any>(`patients/${patientId}`).valueChanges().pipe(
      take(1),
      map(doc => doc ? ({
        id: patientId,
        name: String(doc.name || 'Patient'),
        address: String(doc.address || ''),
        phone: String(doc.phone || ''),
        facilityId: doc.facilityId ?? null,
        room: doc.room ?? doc.roomNumber ?? null,
      }) : null),
      catchError(() => of(null)),
    );
  }

  private buildToday(uid: string, visits: FieldVisit[], tasks: FieldTask[]): TodayFieldWork {
    const { start, end } = this.dayBounds(new Date());
    const overdueTasks: FieldTask[] = [];
    const dueTodayTasks: FieldTask[] = [];
    const completedTodayTasks: FieldTask[] = [];

    for (const task of tasks) {
      const due = this.toDate(task.dueAt);
      const completedAt = this.toDate(task.completedAt);
      if (task.status === 'done') {
        if (completedAt && completedAt >= start && completedAt < end) completedTodayTasks.push(task);
        continue;
      }
      if (due && due < start) overdueTasks.push(task);
      else if (!due || (due >= start && due < end)) dueTodayTasks.push(task);
    }

    const byDue = (a: FieldTask, b: FieldTask) => (this.toDate(a.dueAt)?.getTime() || 0) - (this.toDate(b.dueAt)?.getTime() || 0);
    return {
      uid,
      visits: [...visits].sort((a, b) => (this.toDate(a.start)?.getTime() || 0) - (this.toDate(b.start)?.getTime() || 0)),
      overdueTasks: overdueTasks.sort(byDue),
      dueTodayTasks: dueTodayTasks.sort(byDue),
      completedTodayTasks: completedTodayTasks.sort(byDue),
    };
  }

  private dayBounds(value: Date): { start: Date; end: Date } {
    const start = new Date(value); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    return { start, end };
  }

  toDate(value: any): Date | null {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
}
