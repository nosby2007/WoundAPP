import { Inject, Injectable } from '@angular/core';

import {
  CLINICAL_DATA_PROVIDER,
  ClinicalDataProvider,
  PatientDocumentUploadOptions,
} from './clinical-data-provider';
import { Patient } from './patient.service';
import { MobilePatientDocument } from './mobile-patient-document.service';
import { MobileClinicalContext } from './patient-clinical-context-reader.service';
import { EncounterContext } from './patient-encounter-context-reader.service';

/**
 * Stable application-facing gateway. UI code should prefer this service over
 * importing Firebase-backed readers directly.
 */
@Injectable({ providedIn: 'root' })
export class ClinicalDataService {
  constructor(@Inject(CLINICAL_DATA_PROVIDER) private readonly provider: ClinicalDataProvider) {}

  getPatient(patientId: string): Promise<Patient & Record<string, any>> {
    return this.provider.getPatient(patientId);
  }

  getClinicalContext(patientId: string): Promise<MobileClinicalContext> {
    return this.provider.getClinicalContext(patientId);
  }

  getEncounterContext(patientId: string): Promise<EncounterContext> {
    return this.provider.getEncounterContext(patientId);
  }

  listPatientDocuments(patientId: string): Promise<MobilePatientDocument[]> {
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
