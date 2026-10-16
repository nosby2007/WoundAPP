import { InjectionToken } from '@angular/core';

export interface ClinicalPatientRecord {
  id: string;
  name: string;
  [key: string]: any;
}

export type ClinicalContextKind = 'diagnostic' | 'medicalHistory' | 'allergy';

export interface ClinicalContextFact {
  id: string;
  kind: ClinicalContextKind;
  code: string | null;
  description: string;
  status: string | null;
  reviewStatus: string | null;
  primary: boolean;
  rank: number | null;
  reaction: string | null;
  severity: string | null;
  sourceReference: string | null;
}

export interface ClinicalContext {
  diagnoses: ClinicalContextFact[];
  medicalHistory: ClinicalContextFact[];
  allergies: ClinicalContextFact[];
}

export interface ClinicalEncounterContextItem {
  id: string;
  label: string;
  detail: string;
  source: string | null;
}

export interface ClinicalEncounterContext {
  medications: ClinicalEncounterContextItem[];
  activeOrders: ClinicalEncounterContextItem[];
  vascular: ClinicalEncounterContextItem[];
  systemic: ClinicalEncounterContextItem[];
}

export interface ClinicalPatientDocument {
  id: string;
  name: string;
  type?: string | null;
  description?: string | null;
  url: string;
  path: string;
  mimeType?: string | null;
  size?: number | null;
  createdAt?: any;
  uploadedBy?: { uid?: string | null; email?: string | null; role?: string | null };
}

export interface PatientDocumentUploadOptions {
  type?: string;
  description?: string;
}

/**
 * WoundAPP-facing clinical data contract.
 *
 * This contract owns its DTOs and does not expose Firebase types or JADE
 * service classes. A future provider can therefore implement it without
 * importing the current Firebase-backed services.
 *
 * Phase 1 intentionally exposes only workflows that already exist in
 * production so no persistence semantics or clinical behavior change.
 */
export interface ClinicalDataProvider {
  getPatient(patientId: string): Promise<ClinicalPatientRecord>;
  getClinicalContext(patientId: string): Promise<ClinicalContext>;
  getEncounterContext(patientId: string): Promise<ClinicalEncounterContext>;
  listPatientDocuments(patientId: string): Promise<ClinicalPatientDocument[]>;
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
