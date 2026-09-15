import { Injectable } from '@angular/core';
import { collection, doc, getDoc, onSnapshot, orderBy, query, runTransaction, serverTimestamp, Timestamp, updateDoc, where } from 'firebase/firestore';
import { Observable } from 'rxjs';
import { auth, db } from '../firebase';
import { TenantService } from './tenant.service';
import { FieldRolePolicyService } from './field-role-policy.service';
import { DurableClinicalMutationService } from './durable-clinical-mutation.service';

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
  /** Shared pointer to patients/{patientId}/woundVisits/{woundVisitId}. */
  woundVisitId?: string | null;
  facilityId?: string | null;
  start: any;
  end?: any;
  status: string;
  statusReason?: string | null;
  statusReasonCode?: string | null;
  notDoneAt?: any;
  completedAt?: any;
  nextAppointmentId?: string | null;
  archivedAt?: any;
  archivedByUid?: string | null;
  archiveReason?: string | null;
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
  constructor(
    private tenant: TenantService,
    private rolePolicy: FieldRolePolicyService,
    private durableMutations: DurableClinicalMutationService
  ) {}

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
          const identity = await this.rolePolicy.currentIdentity();
          visits = (await Promise.all(snap.docs.map(async d => ({
            id: d.id,
            ...d.data(),
            patient: await this.patient((d.data() as any).patientId),
          } as FieldVisit))))
            .filter(visit => !visit.archivedAt)
            .filter(visit => this.rolePolicy.canAccessAssignedVisit(identity, visit as any));
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
    if (data.orgId !== orgId || data.assignedToUid !== user.uid || data.archivedAt) return null;
    const identity = await this.rolePolicy.currentIdentity();
    if (!this.rolePolicy.canAccessAssignedVisit(identity, data)) return null;

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

  /**
   * Persist the appointment → woundVisit pointer as soon as WoundAPP opens
   * the field encounter. The Scheduler creates the appointment with no wound
   * identity; WoundAPP owns the first clinical visit id at check-in.
   */
  async linkWoundVisit(
    appointmentId: string,
    patientId: string,
    woundVisitId: string
  ): Promise<'synced' | 'queued'> {
    if (!appointmentId || !patientId || !woundVisitId) {
      throw new Error('Appointment, patient and wound visit are required.');
    }

    // Prospective Scheduler appointments already carry this pointer. Keep the
    // method as an idempotent repair path for older appointments and transient
    // stale mobile snapshots.
    try {
      const snap = await getDoc(doc(db, `appointments/${appointmentId}`));
      if (snap.exists()) {
        const existing = String((snap.data() as any).woundVisitId || '').trim();
        if (existing === woundVisitId) return 'synced';
        if (existing && existing !== woundVisitId) {
          throw new Error('The appointment already points to a different clinical visit.');
        }
      }
    } catch (error: any) {
      if (String(error?.message || '').includes('different clinical visit')) throw error;
      // Continue to the durable repair write when the lookup itself is
      // unavailable; conflict protection will prevent overwriting a server
      // pointer later.
    }

    const result = await this.durableMutations.queueUpdate({
      operation: 'appointment_link_wound_visit',
      patientId,
      entityType: 'appointment',
      entityId: appointmentId,
      firestorePath: `appointments/${appointmentId}`,
      conflict: { expectedAbsentFields: ['woundVisitId'] },
      payload: {
        woundVisitId,
        updatedAt: DurableClinicalMutationService.serverTimestamp(),
      },
    });

    if (result.status === 'needs_review') {
      throw new Error('The appointment already points to another clinical visit. Open Sync Review before continuing.');
    }
    return result.status;
  }

  async completeVisit(id: string): Promise<'synced' | 'queued'> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Sign in required');

    const result = await this.durableMutations.enqueueUpdate({
      operation: 'appointment_complete',
      entityType: 'appointment',
      entityId: id,
      firestorePath: `appointments/${id}`,
      conflict: { expectedAbsentFields: ['completedAt'] },
      payload: {
        status: 'completed',
        completedAt: DurableClinicalMutationService.serverTimestamp(),
        completedByUid: uid,
        updatedAt: DurableClinicalMutationService.serverTimestamp(),
        statusReason: null,
      },
    });

    if (result.status === 'needs_review') {
      throw new Error('The appointment changed before checkout could sync. Review the Sync Center before closing this visit.');
    }
    return result.status;
  }

  /**
   * Mark a scheduled field visit as not done before check-in.
   * This is the mobile equivalent of a skipped round, but preserves a
   * required reason and keeps the encounter available for missed-visit
   * documentation and rescheduling.
   */
  async markVisitNotDone(
    appointmentId: string,
    reasonCode: string,
    reasonText: string
  ): Promise<{ woundVisitId: string | null }> {
    const user = auth.currentUser;
    const orgId = await this.tenant.currentOrgId();
    if (!user || !orgId) throw new Error('Sign in required');
    if (!appointmentId) throw new Error('Visit is required');

    const reason = (reasonText || '').trim();
    const code = (reasonCode || '').trim();
    if (!code) throw new Error('Choose why the visit could not be completed');
    if (!reason) throw new Error('Add a brief reason before marking the visit not done');

    const identity = await this.rolePolicy.currentIdentity();
    const isClinicalVisitWorker = this.rolePolicy.canUseClinicalWorkspace(identity);

    const appointmentRef = doc(db, 'appointments', appointmentId);
    return runTransaction(db, async transaction => {
      const appointmentSnap = await transaction.get(appointmentRef);
      if (!appointmentSnap.exists()) throw new Error('Visit no longer exists');
      const appointment: any = appointmentSnap.data();

      if (appointment.orgId !== orgId || appointment.assignedToUid !== user.uid) {
        throw new Error('You can only mark your own assigned visit not done');
      }
      if (appointment.status === 'completed') {
        throw new Error('A completed visit cannot be changed to not done');
      }
      if (appointment.status === 'not_done') return { woundVisitId: appointment.woundVisitId ?? null };

      const patientId = appointment.patientId ?? null;
      if (!patientId) {
        throw new Error('This appointment has no patient link');
      }

      const linkedId = typeof appointment.woundVisitId === 'string' && appointment.woundVisitId
        ? appointment.woundVisitId
        : null;

      // Licensed clinical roles need a missed woundVisit record even for old
      // appointments created before appointment↔woundVisit linkage existed.
      // Support-level ADL/companion visits remain appointment-only and do not
      // create wound-chart records.
      const woundVisitRef = linkedId
        ? doc(db, `patients/${patientId}/woundVisits/${linkedId}`)
        : (isClinicalVisitWorker ? doc(collection(db, `patients/${patientId}/woundVisits`)) : null);

      let existingWoundVisit: any = null;
      if (linkedId && woundVisitRef) {
        const woundVisitSnap = await transaction.get(woundVisitRef);
        if (woundVisitSnap.exists()) {
          existingWoundVisit = woundVisitSnap.data();
          if (existingWoundVisit.checkIn) {
            throw new Error('This visit already has a check-in. Use the on-site checkout workflow instead.');
          }
        }
      }

      const woundVisitId = woundVisitRef?.id ?? null;
      const appointmentPatch: Record<string, unknown> = {
        status: 'not_done',
        statusReasonCode: code,
        statusReason: reason,
        notDoneAt: serverTimestamp(),
        notDoneByUid: user.uid,
        updatedAt: serverTimestamp(),
      };
      if (woundVisitId) appointmentPatch['woundVisitId'] = woundVisitId;
      transaction.update(appointmentRef, appointmentPatch);

      if (!woundVisitRef) {
        return { woundVisitId: null };
      }

      const commonMissedFields: Record<string, unknown> = {
        orgId,
        facilityId: appointment.facilityId ?? appointment.patient?.facilityId ?? null,
        patientId,
        woundId: appointment.woundId ?? null,
        episodeId: appointment.episodeId ?? null,
        appointmentId,
        appointmentStatus: 'not_done',
        visitType: appointment.visitType ?? 'routine',
        status: 'missed',
        scheduledFor: appointment.start ?? serverTimestamp(),
        clinicianUid: appointment.assignedToUid ?? user.uid,
        clinicianName: appointment.assignedToName ?? user.displayName ?? null,
        clinicianRole: appointment.assignedToRole ?? null,
        executionAuthority: 'woundapp',
        fieldVisitState: 'not_done',
        officeDocumentationState: 'pending_office_documentation',
        notDoneReasonCode: code,
        notDoneReason: reason,
        notDoneAt: serverTimestamp(),
        notDoneByUid: user.uid,
        notDoneByName: user.displayName ?? null,
        mobileWorkflow: {
          appointmentId,
          currentStep: 'not_done',
          lastRoute: '/tabs/today/visit/' + appointmentId,
          lastUpdatedAt: serverTimestamp(),
          steps: {
            not_done: {
              enteredAt: serverTimestamp(),
              byUid: user.uid,
              byName: user.displayName ?? null,
            },
          },
        },
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      };

      if (existingWoundVisit) {
        transaction.update(woundVisitRef, commonMissedFields);
      } else {
        transaction.set(woundVisitRef, {
          ...commonMissedFields,
          summary: appointment.appointmentDetails ?? '',
          nextStep: '',
          placeOfService: appointment.facilityId ? 'facility' : 'home',
          createdAt: serverTimestamp(),
          createdBy: user.uid,
        });
      }

      return { woundVisitId };
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
  /**
   * Scheduling authority lives in JADE Scheduler / Frontdesk.
   * Field clinicians document the recommended follow-up interval in the
   * clinical record; WoundAPP never creates the next appointment itself.
   */
  async scheduleNextVisit(): Promise<string> {
    throw new Error(
      'Next visits are created by Scheduler / Frontdesk. Document the recommended follow-up interval and send it for scheduling.'
    );
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
