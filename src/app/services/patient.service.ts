// src/app/services/patient.service.ts
import { Injectable, inject } from '@angular/core';
import { db } from '../firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { TenantService } from './tenant.service';

export interface Patient {
  id: string;
  name: string;
  patientStatus?: 'active' | 'discharged' | 'transferred' | 'deceased' | null;
  dob?: string;
  mrn?: string;
  room?: string;
  bed?: string;
  photoURL?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  insuranceProvider?: string;
  insuranceId?: string;
  payor?: string;
  admissionDate?: string;
  preferredName?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

/** Thrown when the account has no organization, so the roster cannot be
 *  scoped and the query would be refused. Distinguished from a network
 *  failure so the page can say something useful. */
export class NoOrganizationError extends Error {
  constructor() {
    super('This account is not linked to an organization.');
    this.name = 'NoOrganizationError';
  }
}

@Injectable({ providedIn: 'root' })
export class PatientService {
  private col = collection(db, 'patients');
  private tenant = inject(TenantService);

  /**
   * Patients in the caller's organization, newest first.
   *
   * The `where` clause is not a nicety. Firestore evaluates a list rule
   * against the QUERY, not against the documents it would return:
   * `patients` allows a list only where every document carries the
   * caller's orgId, so the previous unfiltered query was refused outright
   * -- permission-denied even for a user allowed to read all of them.
   *
   * orgId + createdAt is already a composite index in the project's
   * firestore.indexes.json, so the ordering costs nothing extra.
   */
  async getPatient(patientId: string): Promise<Patient & Record<string, any>> {
    const snap = await getDoc(doc(db, 'patients', patientId));
    if (!snap.exists()) throw new Error('Patient not found.');
    return { id: snap.id, ...(snap.data() as any) };
  }

  async updateIntakePatient(patientId: string, patch: {
    name?: string;
    preferredName?: string;
    dob?: string;
    phone?: string;
    email?: string;
    address?: string;
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    zip?: string;
    insuranceProvider?: string;
    insuranceId?: string;
    groupNumber?: string;
    payor?: string;
    policyHolder?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    emergencyRelation?: string;
    referringProvider?: string;
    primaryCareProvider?: string;
    admissionDate?: string;
    roomNumber?: string;
    unit?: string;
  }): Promise<void> {
    const cleaned = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined)
    );
    await updateDoc(doc(db, 'patients', patientId), {
      ...cleaned,
      updatedAt: serverTimestamp(),
    });
  }

  async listPatients(max = 200): Promise<Patient[]> {
    const orgId = await this.tenant.currentOrgId();
    if (!orgId) throw new NoOrganizationError();

    const q = query(
      this.col,
      where('orgId', '==', orgId),
      orderBy('createdAt', 'desc'),
      limit(max),
    );
    const snap = await getDocs(q);

    return snap.docs
      .map(d => {
        const data: any = d.data();
        return {
          id: d.id,
          name: data.name || data.displayName || 'Patient',
          patientStatus: data.patientStatus ?? null,
          dob: data.dob || '',
          mrn: data.mrn || '',
          room: data.room || data.roomNumber || '',
          bed: data.bed || '',
          photoURL: data.photoURL || '',
          phone: data.phone || '',
          email: data.email || '',
          address: data.address || data.address1 || '',
          city: data.city || '',
          state: data.state || '',
          zip: data.zip || '',
          insuranceProvider: data.insuranceProvider || '',
          insuranceId: data.insuranceId || '',
          payor: data.payor || '',
          admissionDate: data.admissionDate || '',
          preferredName: data.preferredName || '',
          emergencyContactName: data.emergencyContactName || '',
          emergencyContactPhone: data.emergencyContactPhone || ''
        } as Patient;
      })
      // The mobile patient roster is an ACTIVE care list. Historical charts
      // remain retrievable through authorized history/reporting workflows,
      // but discharged/transferred/deceased patients are not actionable here.
      .filter(patient => !patient.patientStatus || patient.patientStatus === 'active');
  }
}
