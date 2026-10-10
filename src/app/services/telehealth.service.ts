import { Injectable } from '@angular/core';
import { httpsCallable } from 'firebase/functions';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, functions } from '../firebase';
import { TenantService } from './tenant.service';
import { PatientService } from './patient.service';

export interface MobileTelehealthSession {
  id: string;
  revision: number;
  participant: 'facilitator' | 'provider' | 'patient';
  state: 'scheduled' | 'waiting' | 'in_progress' | 'ended' | 'cancelled' | 'failed';
  consentStatus: string;
  consentVersion: string;
  clinicalContext?: {patientName?: string; woundLabel?: string};
}

export interface FieldTelehealthAppointment {
  id: string; patientName: string; providerName: string; woundLabel?: string;
  reason: string; startIso?: string; status: string; sessionState: string;
}

/** Client of JADE's canonical API; no independent clinical/session persistence. */
@Injectable({providedIn: 'root'})
export class TelehealthService {
  constructor(private tenant: TenantService, private patients: PatientService) {}

  async providers(): Promise<{uid: string; name: string}[]> {
    const orgId = await this.tenant.currentOrgId();
    if (!orgId) throw new Error('Organization required.');
    const snap = await getDocs(query(collection(db, 'users'), where('orgId', '==', orgId)));
    return snap.docs.filter(doc => {
      const d = doc.data();
      const roles = [...(Array.isArray(d['roles']) ? d['roles'] : []), d['role']];
      return d['disabled'] !== true && !['inactive', 'disabled'].includes(d['status']) &&
        roles.some(role => ['provider', 'np', 'md', 'do', 'physician'].includes(String(role).toLowerCase()));
    }).map(doc => ({uid: doc.id, name: String(doc.data()['displayName'] || doc.data()['name'] || 'Provider')}));
  }

  async wounds(patientId: string): Promise<{id: string; label: string}[]> {
    const patient = await this.patients.getPatient(patientId);
    if (!patient['orgId'] || patient['orgId'] !== await this.tenant.currentOrgId()) {
      throw new Error('Patient organization mismatch.');
    }
    const snap = await getDocs(collection(db, `patients/${patientId}/wounds`));
    return snap.docs.map(doc => ({id: doc.id,
      label: String(doc.data()['label'] || doc.data()['location'] || doc.data()['anatomicalLocation'] || 'Documented wound')}));
  }

  async create(input: {patientId: string; woundId: string; providerUid: string; reason: string}) {
    return this.call<{appointmentId: string}>('telehealthCreateFieldConsultV1', input);
  }
  listFacilitatorAppointments(cursor?: string) {
    return this.call<{appointments: FieldTelehealthAppointment[]; nextCursor: string | null}>(
      'telehealthListFacilitatorAppointmentsV1', {cursor: cursor || null});
  }
  async session(appointmentId: string): Promise<MobileTelehealthSession> {
    return (await this.call<{session: MobileTelehealthSession}>('telehealthCreateOrGetSessionV1', {appointmentId})).session;
  }
  async consent(input: {sessionId: string; consentVersion: string; patientLocation: string;
    evidenceNote: string; patientPresent: true; consentConfirmed: true}): Promise<MobileTelehealthSession> {
    return (await this.call<{session: MobileTelehealthSession}>('telehealthRecordFacilitatedConsentV1', input)).session;
  }
  videoToken(sessionId: string) {
    return this.call<{token: string; room: string}>('telehealthIssueVideoTokenV1', {sessionId});
  }
  async cancel(session: MobileTelehealthSession): Promise<MobileTelehealthSession> {
    return (await this.call<{session: MobileTelehealthSession}>('telehealthTransitionSessionV1', {
      sessionId: session.id, nextState: 'cancelled', expectedRevision: session.revision,
    })).session;
  }
  private async call<T>(name: string, data: unknown): Promise<T> {
    if (!navigator.onLine) throw new Error('Telehealth requires an online connection. No request was queued.');
    return (await httpsCallable<unknown, T>(functions, name)(data)).data;
  }
}
