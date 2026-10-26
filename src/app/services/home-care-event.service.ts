import { inject, Injectable } from '@angular/core';
import { addDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { ClinicalIdentityService } from './clinical-identity.service';
import { PatientService } from './patient.service';
import {
  HomeCareEventClass,
  HomeCareEventSeverity,
  homeCareEventClass,
  homeCareEventOption,
  HOME_CARE_LOCATIONS,
  jadeIncidentCategory,
} from '../shared/home-care-event';

export interface HomeCareEventCreate {
  eventClass: HomeCareEventClass;
  eventType: string;
  patientId?: string | null;
  occurredAt: Date;
  locationType: string;
  locationDetails?: string | null;
  description: string;
  immediateActions: string;
  severity: HomeCareEventSeverity;
  witnessed: boolean;
  providerNotified: boolean;
  familyNotified: boolean;
  supervisorNotified: boolean;
  emergencyServicesCalled: boolean;
  appointmentId?: string | null;
  woundVisitId?: string | null;
}
@Injectable({ providedIn: 'root' })
export class HomeCareEventService {
  private readonly identityService = inject(ClinicalIdentityService);
  private readonly patients = inject(PatientService);

  async create(input: HomeCareEventCreate): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new Error('Your secure session has ended. Sign in again before submitting the report.');

    const definition = homeCareEventClass(input.eventClass);
    const option = homeCareEventOption(input.eventClass, input.eventType);
    if (!definition || !option) throw new Error('Select a valid home-care event type.');
    if (definition.requiresPatient && !input.patientId) throw new Error('Select the patient connected to this report.');
    if (!(input.occurredAt instanceof Date) || Number.isNaN(input.occurredAt.getTime())) throw new Error('Enter a valid event date and time.');
    if (input.occurredAt.getTime() > Date.now() + 5 * 60_000) throw new Error('The event time cannot be in the future.');
    if (input.description.trim().length < 10) throw new Error('Describe what happened using at least 10 characters.');
    if (input.immediateActions.trim().length < 3) throw new Error('Document the immediate action taken, or enter "None".');

    const identity = await this.identityService.requireCurrentIdentity();
    const patient = input.patientId ? await this.patients.getPatient(input.patientId) : null;
    const location = HOME_CARE_LOCATIONS.find(item => item.value === input.locationType);
    if (!location) throw new Error('Select where the event occurred.');

    const locationText = [location.label, input.locationDetails?.trim()].filter(Boolean).join(' — ');
    const actionsTaken = [input.immediateActions.trim()];
    if (input.emergencyServicesCalled) actionsTaken.push('Emergency services called');
    if (input.providerNotified) actionsTaken.push('Provider notified');
    if (input.familyNotified) actionsTaken.push('Patient/family notified');
    if (input.supervisorNotified) actionsTaken.push('Supervisor notified');

    const created = await addDoc(collection(db, 'incidents'), {
      schemaVersion: 2,
      reportingProgram: 'home_care_event_portal',
      sourceApp: 'woundapp',
      careSetting: 'home_care',
      orgId: identity.orgId,
      facilityId: null,

      incidentDate: Timestamp.fromDate(input.occurredAt),
      eventClass: input.eventClass,
      eventClassLabel: definition.label,
      eventType: input.eventType,
      eventTypeLabel: option.label,
      category: jadeIncidentCategory(input.eventClass, input.eventType),
      type: option.label,
      nature: definition.label,
      locationType: input.locationType,
      location: locationText,
      description: input.description.trim(),
      immediateActions: input.immediateActions.trim(),
      actionsTaken,
      witnessed: !!input.witnessed,
      injurySeverity: input.severity,
      providerNotified: !!input.providerNotified,
      familyNotified: !!input.familyNotified,
      supervisorNotified: !!input.supervisorNotified,
      emergencyServicesCalled: !!input.emergencyServicesCalled,

      patientId: patient?.id || '',
      residentId: patient?.id || '',
      patientName: patient?.name || '',
      residentName: patient?.name || '',
      mrn: patient?.mrn || '',
      unit: 'Home care',

      appointmentId: input.appointmentId || null,
      woundVisitId: input.woundVisitId || null,
      status: 'Open',
      requiresSignatures: false,
      struckOut: false,

      createdBy: user.uid,
      createdByUid: user.uid,
      createdByName: identity.displayName,
      reporter: identity,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return created.id;
  }
}
