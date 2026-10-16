import { Inject, Injectable } from '@angular/core';

import {
  CLINICAL_DATA_PROVIDER,
  ClinicalContext,
  ClinicalDataProvider,
  ClinicalEncounterContext,
  ClinicalPatientDocument,
  ClinicalPatientRecord,
  PatientDocumentUploadOptions,
} from './clinical-data-provider';

/**
 * Stable application-facing gateway. UI code should prefer this service over
 * importing Firebase-backed readers directly.
 */
@Injectable({ providedIn: 'root' })
export class ClinicalDataService {
  constructor(@Inject(CLINICAL_DATA_PROVIDER) private readonly provider: ClinicalDataProvider) {}

  getPatient(patientId: string): Promise<ClinicalPatientRecord> {
    return this.provider.getPatient(patientId);
  }

  getClinicalContext(patientId: string): Promise<ClinicalContext> {
    return this.provider.getClinicalContext(patientId);
  }

  getEncounterContext(patientId: string): Promise<ClinicalEncounterContext> {
    return this.provider.getEncounterContext(patientId);
  }

  listPatientDocuments(patientId: string): Promise<ClinicalPatientDocument[]> {
    return this.provider.listPatientDocuments(patientId);
  }

  uploadPatientDocuments(
    patientId: string,
    files: File[],
    options: PatientDocumentUploadOptions,
  ): Promise<void> {
    return this.provider.uploadPatientDocuments(patientId, files, options);
  }
}
