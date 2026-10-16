import { Injectable } from '@angular/core';

import {
  ClinicalDataProvider,
  PatientDocumentUploadOptions,
} from './clinical-data-provider';
import { Patient, PatientService } from './patient.service';
import { MobilePatientDocument, MobilePatientDocumentService } from './mobile-patient-document.service';
import {
  MobileClinicalContext,
  PatientClinicalContextReaderService,
} from './patient-clinical-context-reader.service';
import {
  EncounterContext,
  PatientEncounterContextReaderService,
} from './patient-encounter-context-reader.service';

/**
 * Current production adapter.
 *
 * This deliberately delegates to the existing services rather than moving
 * Firestore code in phase 1. That keeps the same Firebase project, paths,
 * security rules, error behavior, and upload metadata while creating a stable
 * seam that can later host standalone/FHIR/EHR implementations.
 */
@Injectable({ providedIn: 'root' })
export class JadeFirebaseClinicalDataProvider implements ClinicalDataProvider {
  constructor(
    private readonly patients: PatientService,
    private readonly documents: MobilePatientDocumentService,
    private readonly clinicalContext: PatientClinicalContextReaderService,
    private readonly encounterContext: PatientEncounterContextReaderService,
  ) {}

  getPatient(patientId: string): Promise<Patient & Record<string, any>> {
    return this.patients.getPatient(patientId);
  }

  getClinicalContext(patientId: string): Promise<MobileClinicalContext> {
    return this.clinicalContext.load(patientId);
  }

  getEncounterContext(patientId: string): Promise<EncounterContext> {
    return this.encounterContext.load(patientId);
  }

  listPatientDocuments(patientId: string): Promise<MobilePatientDocument[]> {
    return this.documents.list(patientId);
  }

  uploadPatientDocuments(
    patientId: string,
    files: File[],
    options: PatientDocumentUploadOptions,
  ): Promise<void> {
    return this.documents.upload(patientId, files, options);
  }
}
