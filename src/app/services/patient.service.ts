// src/app/services/patient.service.ts
import { Injectable, inject } from '@angular/core';
import { db } from '../firebase';
import {
  collection,
  getDocs,
  orderBy,
  limit,
  query,
  where,
} from 'firebase/firestore';
import { TenantService } from './tenant.service';

export interface Patient {
  id: string;
  name: string;
  dob?: string;
  mrn?: string;
  room?: string;
  bed?: string;
  photoURL?: string;
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

    return snap.docs.map(d => {
      const data: any = d.data();
      return {
        id: d.id,
        name: data.name || data.displayName || 'Patient',
        dob: data.dob || '',
        mrn: data.mrn || '',
        room: data.room || data.roomNumber || '',
        bed: data.bed || '',
        photoURL: data.photoURL || ''
      };
    });
  }
}
