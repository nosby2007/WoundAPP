import { Injectable } from '@angular/core';
import { httpsCallable } from 'firebase/functions';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, functions } from '../firebase';
import { TenantService } from './tenant.service';
import { PatientService } from './patient.service';

export interface MobileTelehealthSession {
  id: string;
  appointmentId: string;
  revision: number;
  participant: 'facilitator' | 'provider' | 'patient';
  deliveryMode: 'telehealth_video' | 'telehealth_audio';
  state: 'scheduled' | 'waiting' | 'in_progress' | 'ended' | 'cancelled' | 'failed';
  consentStatus: string;
  consentVersion: string;
  signedNoteId?: string | null;
  draftNoteId?: string | null;
  billingReviewStatus?: string | null;
  clinicalContext?: {
    patientId?: string;
    patientName?: string;
    woundId?: string;
    woundLabel?: string;
    serviceDateIso?: string | null;
    patientReportedLocation?: string | null;
  };
}

export interface MobileTelehealthAppointment {
  id: string;
  patientName: string;
  providerName?: string | null;
  facilitatorName?: string | null;
  woundLabel?: string | null;
  reason?: string | null;
  deliveryMode: 'telehealth_video' | 'telehealth_audio';
  status: string;
  startIso?: string | null;
  sessionState: 'not_started' | 'scheduled' | 'waiting' | 'in_progress' | 'ended' | 'cancelled' | 'failed' | string;
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

  async myConsultations(): Promise<MobileTelehealthAppointment[]> {
    const results = await Promise.allSettled([
      this.call<{ appointments: MobileTelehealthAppointment[] }>('telehealthListFacilitatorAppointmentsV1', {}),
      this.call<{ appointments: MobileTelehealthAppointment[] }>('telehealthListProviderAppointmentsV1', {}),
    ]);
    const rows = results.flatMap((result) =>
      result.status === 'fulfilled' ? (result.value.appointments || []) : []
    );
    const unique = new Map(rows.map((item) => [item.id, item]));
    return [...unique.values()].sort((a, b) =>
      String(b.startIso || '').localeCompare(String(a.startIso || ''))
    );
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

  async registerDraftNote(sessionId: string, noteId: string): Promise<void> {
    await this.call('telehealthRegisterDraftNoteV1', { sessionId, noteId });
  }
  private async call<T>(name: string, data: unknown): Promise<T> {
    if (!navigator.onLine) throw new Error('Telehealth requires an online connection. No request was queued.');
    return (await httpsCallable<unknown, T>(functions, name)(data)).data;
  }
}