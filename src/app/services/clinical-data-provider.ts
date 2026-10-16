import { InjectionToken } from '@angular/core';

export interface ClinicalPatientRecord {
  id: string;
  name: string;
  [key: string]: any;
}

/**
 * Backend-agnostic contract used by WoundAPP pages.
 *
 * Phase 1 is intentionally tiny: only the patient read used by the progress
 * note header is abstracted. The production source of truth remains the
 * existing Firebase-backed PatientService.
 */
export interface ClinicalDataProvider {
  getPatient(patientId: string): Promise<ClinicalPatientRecord>;
}

export const CLINICAL_DATA_PROVIDER =
  new InjectionToken<ClinicalDataProvider>('CLINICAL_DATA_PROVIDER');
