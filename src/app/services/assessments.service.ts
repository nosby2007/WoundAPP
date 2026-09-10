// src/app/services/assessments.service.ts
import { inject, Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  query,
  orderBy,
  doc,
  docData,
  addDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Storage, ref, uploadString, getDownloadURL } from '@angular/fire/storage';
import { ClinicalIdentityService } from './clinical-identity.service';

export interface MobileAssessment {
  id: string;
  woundId?: string;
  type?: string;
  stage?: string;
  location?: string;
  acquired?: string;
  status?: string;
  assessedAt?: Date;
  photoURL?: string;
}

@Injectable({ providedIn: 'root' })
export class AssessmentsService {
  private firestore = inject(Firestore);
  private storage = inject(Storage);
  private clinicalIdentity = inject(ClinicalIdentityService);

  listForPatient(patientId: string): Observable<MobileAssessment[]> {
    const colRef = collection(this.firestore, `patients/${patientId}/woundAssessments`);
    const q = query(colRef, orderBy('createdAt', 'desc'));
    return collectionData(q, { idField: 'id' }).pipe(
      map((docs: any[]) => docs.map((d) => ({
        id: d.id,
        woundId: d.woundId || null,
        type: d.describe?.type || d.type || 'Unknown',
        stage: d.describe?.stage || d.stage,
        location: d.describe?.location || d.location || 'Unknown',
        acquired: (d.describe?.acquired || d.acquired || '').toString().toLowerCase(),
        status: (d.progress?.status || d.status || 'unknown').toString().toLowerCase(),
        assessedAt: d.assessedAt?.toDate ? d.assessedAt.toDate()
          : d.createdAt?.toDate ? d.createdAt.toDate()
          : d.assessedAt ? new Date(d.assessedAt)
          : d.createdAt ? new Date(d.createdAt) : undefined,
        photoURL: d.photoURL || null,
      })))
    );
  }

  getPatient(patientId: string): Observable<{ name: string } | null> {
    const refDoc = doc(this.firestore, `patients/${patientId}`);
    return docData(refDoc).pipe(map((d: any) => d ? { name: d.name || d.displayName || 'Patient' } : null));
  }

  get(patientId: string, assessmentId: string): Observable<MobileAssessment | undefined> {
    const refDoc = doc(this.firestore, `patients/${patientId}/woundAssessments/${assessmentId}`);
    return docData(refDoc).pipe(
      map((d: any) => d ? {
        id: assessmentId,
        woundId: d.woundId || null,
        type: d.describe?.type || d.type || 'Unknown',
        stage: d.describe?.stage || d.stage,
        location: d.describe?.location || d.location || 'Unknown',
        acquired: (d.describe?.acquired || d.acquired || '').toString().toLowerCase(),
        status: (d.progress?.status || d.status || 'unknown').toString().toLowerCase(),
        assessedAt: d.assessedAt?.toDate ? d.assessedAt.toDate()
          : d.createdAt?.toDate ? d.createdAt.toDate()
          : d.assessedAt ? new Date(d.assessedAt)
          : d.createdAt ? new Date(d.createdAt) : undefined,
        photoURL: d.photoURL || null,
      } : undefined)
    );
  }

  getRaw(patientId: string, assessmentId: string): Observable<any | null> {
    const refDoc = doc(this.firestore, `patients/${patientId}/woundAssessments/${assessmentId}`);
    return docData(refDoc).pipe(map((d: any) => d ? { ...d, id: assessmentId } : null));
  }

  buildPayloadFromForm(formValue: any) {
    const now = new Date();
    return {
      describe: {
        type: formValue.type || '', stage: formValue.stage || '',
        location: formValue.location || '', acquired: formValue.acquired || '',
      },
      exudate: { type: formValue.exudateType || '', amount: formValue.exudateAmount || '', odor: formValue.exudateOdor || '' },
      measurements: { length: formValue.length || null, width: formValue.width || null, depth: formValue.depth || null },
      progress: { status: formValue.status || 'ongoing' },
      assessedAt: formValue.assessedAt ? new Date(formValue.assessedAt) : now,
      updatedAt: serverTimestamp(),
      createdAt: formValue.createdAt || serverTimestamp(),
    };
  }

  async uploadWoundPhoto(patientId: string, assessmentId: string, dataUrl: string, uploadedBy: string): Promise<string> {
    const path = `patients/${patientId}/documents/wounds/${assessmentId}.jpg`;
    const storageRef = ref(this.storage, path);
    await uploadString(storageRef, dataUrl, 'data_url', {
      contentType: 'image/jpeg',
      customMetadata: { patientId, uploadedBy },
    });
    return getDownloadURL(storageRef);
  }

  async create(patientId: string, data: any): Promise<string> {
    const colRef = collection(this.firestore, `patients/${patientId}/woundAssessments`);
    const payload = await this.withCanonicalAuthor(data);
    const created = await addDoc(colRef, payload);
    return created.id;
  }

  newId(patientId: string): string {
    return doc(collection(this.firestore, `patients/${patientId}/woundAssessments`)).id;
  }

  async createWithId(patientId: string, id: string, data: any): Promise<void> {
    const payload = await this.withCanonicalAuthor(data);
    await setDoc(doc(this.firestore, `patients/${patientId}/woundAssessments/${id}`), payload);
  }

  update(patientId: string, id: string, data: any): Promise<void> {
    const refDoc = doc(this.firestore, `patients/${patientId}/woundAssessments/${id}`);
    return updateDoc(refDoc, data);
  }

  listForWound(patientId: string, woundId: string): Observable<MobileAssessment[]> {
    return this.listForPatient(patientId).pipe(
      map(list => (list || []).filter(a => (a.woundId || a.id) === woundId))
    );
  }

  private async withCanonicalAuthor(data: any): Promise<any> {
    const identity = await this.clinicalIdentity.requireCurrentIdentity();
    return {
      ...data,
      createdBy: identity.uid,
      createdByUid: identity.uid,
      createdByName: identity.displayName,
      authorIdentity: identity,
    };
  }
}
