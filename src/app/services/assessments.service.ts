  
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
  updateDoc,
  serverTimestamp,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Storage, ref, uploadString, getDownloadURL } from '@angular/fire/storage';

export interface MobileAssessment {
  id: string;
  woundId?: string;     // ✅ nouvelle clé
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

  /** ⚕️ Liste des évaluations pour un patient */
  listForPatient(patientId: string): Observable<MobileAssessment[]> {
    console.log('[AssessmentsService] listForPatient patientId =', patientId);

    const colRef = collection(
      this.firestore,
      `patients/${patientId}/woundAssessments`,
    );

    const q = query(colRef, orderBy('createdAt', 'desc'));

    return collectionData(q, { idField: 'id' }).pipe(
      map((docs: any[]) => {
        console.log(
          '[AssessmentsService] raw docs count =',
          docs.length,
          'for patientId =',
          patientId,
        );

        const mapped = docs.map((d) => ({
          id: d.id,
          woundId: d.woundId || null,   // ✅ on récupère si présent
          type: d.describe?.type || d.type || 'Unknown',
          stage: d.describe?.stage || d.stage,
          location: d.describe?.location || d.location || 'Unknown',
          acquired: (d.describe?.acquired || d.acquired || '')
            .toString()
            .toLowerCase(),
          status: (d.progress?.status || d.status || 'unknown')
            .toString()
            .toLowerCase(),
          assessedAt: d.assessedAt?.toDate
            ? d.assessedAt.toDate()
            : d.createdAt?.toDate
            ? d.createdAt.toDate()
            : d.assessedAt
            ? new Date(d.assessedAt)
            : d.createdAt
            ? new Date(d.createdAt)
            : undefined,
          photoURL: d.photoURL || null,
        }));

        console.log(
          '[AssessmentsService] mapped assessments =',
          mapped.length,
          'for patientId =',
          patientId,
        );

        return mapped;
      }),
    );
  }

  /** 👤 Récup info patient */
  getPatient(patientId: string): Observable<{ name: string } | null> {
    console.log('[AssessmentsService] getPatient patientId =', patientId);

    const refDoc = doc(this.firestore, `patients/${patientId}`);
    return docData(refDoc).pipe(
      map((d: any) => {
        console.log(
          '[AssessmentsService] patient doc =',
          d ? 'FOUND' : 'NOT FOUND',
          'for patientId =',
          patientId,
        );

        return d
          ? {
              name: d.name || d.displayName || 'Patient',
            }
          : null;
      }),
    );
  }

  /** Une évaluation précise (version simplifiée) */
  get(
    patientId: string,
    assessmentId: string,
  ): Observable<MobileAssessment | undefined> {
    const refDoc = doc(
      this.firestore,
      `patients/${patientId}/woundAssessments/${assessmentId}`,
    );

    return docData(refDoc).pipe(
      map((d: any) =>
        d
          ? {
              id: assessmentId,
              type: d.describe?.type || d.type || 'Unknown',
              stage: d.describe?.stage || d.stage,
              location: d.describe?.location || d.location || 'Unknown',
              acquired: (d.describe?.acquired || d.acquired || '')
                .toString()
                .toLowerCase(),
              status: (d.progress?.status || d.status || 'unknown')
                .toString()
                .toLowerCase(),
              assessedAt: d.assessedAt?.toDate
                ? d.assessedAt.toDate()
                : d.createdAt?.toDate
                ? d.createdAt.toDate()
                : d.assessedAt
                ? new Date(d.assessedAt)
                : d.createdAt
                ? new Date(d.createdAt)
                : undefined,
              photoURL: d.photoURL || null,
            }
          : undefined,
      ),
    );
  }

  /** 🔍 Récupère le document brut complet (pour EDIT) */
  getRaw(patientId: string, assessmentId: string): Observable<any | null> {
    const refDoc = doc(
      this.firestore,
      `patients/${patientId}/woundAssessments/${assessmentId}`,
    );

    return docData(refDoc).pipe(
      map((d: any) => (d ? { ...d, id: assessmentId } : null)),
    );
  }

  /** Payload complet (si tu veux le réutiliser ailleurs) */
  buildPayloadFromForm(formValue: any) {
    const now = new Date();

    return {
      describe: {
        type: formValue.type || '',
        stage: formValue.stage || '',
        location: formValue.location || '',
        acquired: formValue.acquired || '',
      },
      exudate: {
        type: formValue.exudateType || '',
        amount: formValue.exudateAmount || '',
        odor: formValue.exudateOdor || '',
      },
      measurements: {
        length: formValue.length || null,
        width: formValue.width || null,
        depth: formValue.depth || null,
      },
      progress: {
        status: formValue.status || 'ongoing',
      },
      assessedAt: formValue.assessedAt ? new Date(formValue.assessedAt) : now,
      updatedAt: serverTimestamp(),
      createdAt: formValue.createdAt || serverTimestamp(),
    };
  }

  /** 📸 upload de la photo (dataUrl) vers Storage */
  /**
   * Path and metadata must match storage.rules' patients/{patientId}/
   * documents/wounds/{fileName} pattern exactly -- the web app's own wound
   * photo uploads (WoundAssessmentService) already use this same path.
   * Storage rules require request.resource.metadata.patientId/uploadedBy
   * to be set (patientUploadMatches()); without them every upload here
   * fell through to the rules file's final catch-all deny, regardless of
   * the uploader's role.
   */
  async uploadWoundPhoto(
    patientId: string,
    assessmentId: string,
    dataUrl: string,
    uploadedBy: string,
  ): Promise<string> {
    const path = `patients/${patientId}/documents/wounds/${assessmentId}.jpg`;
    const storageRef = ref(this.storage, path);

    await uploadString(storageRef, dataUrl, 'data_url', {
      contentType: 'image/jpeg',
      customMetadata: { patientId, uploadedBy },
    });
    const url = await getDownloadURL(storageRef);
    return url;
  }

  /** CREATE dans patients/{patientId}/woundAssessments */
  create(patientId: string, data: any): Promise<string> {
    const colRef = collection(
      this.firestore,
      `patients/${patientId}/woundAssessments`,
    );

    // ❌ ne pas JSON.stringify : ça casse les Date/timestamp
    // const payload = JSON.parse(JSON.stringify(data));

    return addDoc(colRef, data).then((ref) => ref.id);
  }

  /** UPDATE du même doc */
  update(patientId: string, id: string, data: any): Promise<void> {
    const refDoc = doc(
      this.firestore,
      `patients/${patientId}/woundAssessments/${id}`,
    );

    // ❌ idem ici
    // const payload = JSON.parse(JSON.stringify(data));

    return updateDoc(refDoc, data);
  }

/** Liste des évaluations pour une plaie spécifique d'un patient */
 listForWound(patientId: string, woundId: string): Observable<MobileAssessment[]> {
  return this.listForPatient(patientId).pipe(
    map(list =>
      (list || []).filter(a => {
        const effectiveWoundId = a.woundId || a.id; // 🔑 fallback pour anciens docs
        return effectiveWoundId === woundId;
      }),
    ),
  );
}

}
   