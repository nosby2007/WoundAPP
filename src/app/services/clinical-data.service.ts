import { Inject, Injectable } from '@angular/core';

import {
  CLINICAL_DATA_PROVIDER,
  ClinicalDataProvider,
  ClinicalPatientRecord,
} from './clinical-data-provider';

@Injectable({ providedIn: 'root' })
export class ClinicalDataService {
  constructor(
    @Inject(CLINICAL_DATA_PROVIDER)
    private readonly provider: ClinicalDataProvider,
  ) {}

  getPatient(patientId: string): Promise<ClinicalPatientRecord> {
    return this.provider.getPatient(patientId);
  }
}
