import { Injectable } from '@angular/core';

import { ClinicalDataProvider, ClinicalPatientRecord } from './clinical-data-provider';
import { PatientService } from './patient.service';

/**
 * Current production adapter. It delegates to the existing PatientService so
 * Firebase project, paths, rules and runtime behavior remain unchanged.
 */
@Injectable({ providedIn: 'root' })
export class JadeFirebaseClinicalDataProvider implements ClinicalDataProvider {
  constructor(private readonly patients: PatientService) {}

  getPatient(patientId: string): Promise<ClinicalPatientRecord> {
    return this.patients.getPatient(patientId);
  }
}
