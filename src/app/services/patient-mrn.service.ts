import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PatientMrnService {
  /**
   * Human-readable MRN derived from the unique Firestore patient id.
   * No sequential counter = no race condition, no second database write
   * required to reserve a number, and the raw backend document id is never
   * shown to staff.
   *
   * Example: PHWC-2609-A7K3Q9
   */
  fromPatientId(orgId: string | null | undefined, patientId: string, date = new Date()): string {
    if (!patientId) throw new Error('Patient id is required to generate an MRN.');
    const prefix = this.prefix(orgId);
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const suffix = patientId.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase().padStart(6, '0');
    return `${prefix}-${yy}${mm}-${suffix}`;
  }

  private prefix(orgId: string | null | undefined): string {
    const value = String(orgId || 'PATIENT').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return (value.slice(0, 5) || 'PT').padEnd(2, 'X');
  }
}
