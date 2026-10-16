import { InjectionToken } from '@angular/core';

import { Patient } from './patient.service';
import { MobilePatientDocument } from './mobile-patient-document.service';
import { MobileClinicalContext } from './patient-clinical-context-reader.service';
import { EncounterContext } from './patient-encounter-context-reader.service';

export interface PatientDocumentUploadOptions {
  type?: string;
  description?: string;
}

/**
 * WoundAPP-facing clinical data contract.
 *
 * Pages should depend on this contract instead of knowing whether the current
 * tenant is backed by JADE/Firebase, a standalone store, or a future EHR/FHIR
 * integration. Phase 1 intentionally exposes only workflows that already exist
 * in production so no clinical behavior or persistence semantics change.
 */
export interface ClinicalDataProvider {
  getPatient(patientId: string): Promise<Patient & Record<string, any>>;
  getClinicalContext(patientId: string): Promise<MobileClinicalContext>;
  getEncounterContext(patientId: string): Promise<EncounterContext>;
  listPatientDocuments(patientId: string): Promise<MobilePatientDocument[]>;
  uploadPatientDocuments(
    patientId: string,
    files: File[],
    options: PatientDocumentUploadOptions,
  ): Promise<void>;
}

/**
 * Injection seam for future providers. Production remains explicitly wired to
 * the existing JADE/Firebase adapter until another provider is implemented and
 * validated tenant-by-tenant.
 */
export const CLINICAL_DATA_PROVIDER = new InjectionToken<ClinicalDataProvider>('CLINICAL_DATA_PROVIDER');
