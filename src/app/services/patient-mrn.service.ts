import { Injectable, inject } from '@angular/core';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { TenantService } from './tenant.service';

@Injectable({ providedIn: 'root' })
export class PatientMrnService {
  private tenant = inject(TenantService);
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

  async ensureForPatient(patientId: string): Promise<string | null> {
    if (!patientId) return null;
    const ref = doc(db, 'patients', patientId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data: any = snap.data();
    if (typeof data.mrn === 'string' && data.mrn.trim()) return data.mrn.trim();

    const orgId = await this.tenant.currentOrgId();
    if (!orgId || (data.orgId && data.orgId !== orgId)) return null;

    const mrn = this.fromPatientId(orgId, patientId, this.patientDate(data));
    await updateDoc(ref, { mrn, updatedAt: serverTimestamp() });
    return mrn;
  }

  private patientDate(data: any): Date {
    const value = data?.createdAt;
    if (typeof value?.toDate === 'function') return value.toDate();
    return new Date();
  }

  private prefix(orgId: string | null | undefined): string {
    const value = String(orgId || 'PATIENT').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return (value.slice(0, 5) || 'PT').padEnd(2, 'X');
  }
}
