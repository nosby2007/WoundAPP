// src/app/services/patient.service.ts
import { Injectable } from '@angular/core';
import { db } from '../firebase';
import {
  collection,
  getDocs,
  orderBy,
  limit,
  query
} from 'firebase/firestore';

export interface Patient {
  id: string;
  name: string;
  dob?: string;
  mrn?: string;
  room?: string;
  bed?: string;
  photoURL?: string;
}

@Injectable({ providedIn: 'root' })
export class PatientService {
  private col = collection(db, 'patients');

  /** Charge les patients (max 200) triés par createdAt desc si dispo */
  async listPatients(max = 200): Promise<Patient[]> {
    const q = query(this.col, orderBy('createdAt', 'desc'), limit(max));
    const snap = await getDocs(q);

    return snap.docs.map(d => {
      const data: any = d.data();
      return {
        id: d.id,
        name: data.name || data.displayName || 'Patient',
        dob: data.dob || '',
        mrn: data.mrn || '',
        room: data.room || '',
        bed: data.bed || '',
        photoURL: data.photoURL || ''
      };
    });
  }
}
