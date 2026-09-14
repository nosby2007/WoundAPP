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
  writeBatch,
  arrayUnion,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Storage, ref, uploadString, getDownloadURL } from '@angular/fire/storage';
import { ClinicalIdentityService } from './clinical-identity.service';
import { ClinicalAuditService } from './clinical-audit.service';

export interface FieldAssessmentContext {
  appointmentId?: string | null;
  fieldEncounterVisitId?: string | null;
  /** True only for the first assessment that establishes a brand-new wound. */
  newWound?: boolean;
}

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
  private audit = inject(ClinicalAuditService);

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
    await this.audit.record({ action: 'wound_assessment_created', patientId, entityType: 'woundAssessment', entityId: created.id });
    return created.id;
  }

  newId(patientId: string): string {
    return doc(collection(this.firestore, `patients/${patientId}/woundAssessments`)).id;
  }

  async createWithId(
    patientId: string,
    id: string,
    data: any,
    fieldContext: FieldAssessmentContext = {}
  ): Promise<void> {
    const payload = await this.withCanonicalAuthor({
      ...data,
      appointmentId: fieldContext.appointmentId || null,
      fieldEncounterVisitId: fieldContext.fieldEncounterVisitId || null,
    });
    const identity = payload.authorIdentity;
    const batch = writeBatch(this.firestore);
    const assessmentRef = doc(this.firestore, `patients/${patientId}/woundAssessments/${id}`);

    if (fieldContext.newWound) {
      // A new wound is established at the bedside, not speculatively by JADE
      // before the visit. WoundAPP writes the native wound and an intake
      // episode shell in the same batch as the first assessment.
      const patientSnap = await getDoc(doc(this.firestore, `patients/${patientId}`));
      if (!patientSnap.exists()) throw new Error('Patient not found.');
      const patient = patientSnap.data() as any;
      const facilityId = patient.facilityId ?? patient.primaryFacilityId ?? null;
      const episodeRef = doc(collection(this.firestore, `patients/${patientId}/woundEpisodes`));
      const now = serverTimestamp();
      const actor = {
        uid: identity.uid,
        displayName: identity.displayName,
        role: identity.role,
        credentials: identity.credentials ?? null,
        npi: identity.npi ?? null,
      };

      payload.episodeId = episodeRef.id;

      batch.set(doc(this.firestore, `patients/${patientId}/wounds/${id}`), {
        orgId: identity.orgId,
        facilityId,
        patientId,
        label: payload.describe?.location || `Wound ${id.slice(0, 6)}`,
        type: payload.describe?.type || 'Other',
        stage: payload.describe?.stage || null,
        acquired: payload.describe?.acquired || null,
        location: payload.describe?.location || null,
        firstAssessmentId: id,
        latestAssessmentId: id,
        latestAssessedAt: payload.assessedAt ?? now,
        activeEpisodeId: episodeRef.id,
        workflow: {
          state: 'created',
          history: [{
            toState: 'created',
            fromState: null,
            occurredAt: now,
            actor,
            comment: 'Wound established from WoundAPP field assessment.',
          }],
        },
        sourceOfTruth: 'woundapp',
        createdAt: now,
        updatedAt: now,
        createdBy: actor,
        updatedBy: actor,
      });

      batch.set(episodeRef, {
        orgId: identity.orgId,
        facilityId,
        patientId,
        woundId: id,
        episodeType: 'treatment',
        status: 'active',
        clinicalState: 'intake_pending',
        title: payload.describe?.location
          ? `${payload.describe.location} wound episode`
          : 'Field wound episode',
        primaryGoal: '',
        careVenue: facilityId ? 'facility' : 'home_health',
        assignedClinicianUid: identity.uid,
        assignedClinicianName: identity.displayName,
        episodeOwnerType: identity.role === 'np' ? 'np' : 'rn',
        providerOfRecordUid: identity.role === 'np' ? identity.uid : null,
        providerOfRecordName: identity.role === 'np' ? identity.displayName : null,
        providerOfRecordNpi: identity.role === 'np' ? identity.npi : null,
        billingProviderUid: identity.role === 'np' ? identity.uid : null,
        billingProviderName: identity.role === 'np' ? identity.displayName : null,
        billingProviderNpi: identity.role === 'np' ? identity.npi : null,
        needsProviderAssignment: identity.role !== 'np',
        startDate: new Date().toISOString().slice(0, 10),
        notes: 'Created from WoundAPP first field assessment.',
        sourceOfTruth: 'woundapp',
        appointmentId: fieldContext.appointmentId || null,
        fieldEncounterVisitId: fieldContext.fieldEncounterVisitId || null,
        createdAt: now,
        updatedAt: now,
        createdBy: identity.uid,
        updatedBy: identity.uid,
      });

      if (fieldContext.fieldEncounterVisitId) {
        batch.update(
          doc(this.firestore, `patients/${patientId}/woundVisits/${fieldContext.fieldEncounterVisitId}`),
          {
            fieldWoundIds: arrayUnion(id),
            fieldEpisodeIds: arrayUnion(episodeRef.id),
            updatedAt: now,
            updatedBy: identity.uid,
          }
        );
      }
    }

    batch.set(assessmentRef, payload);
    await batch.commit();
    await this.audit.record({ action: 'wound_assessment_created', patientId, entityType: 'woundAssessment', entityId: id });
  }

  async update(patientId: string, id: string, data: any): Promise<void> {
    const refDoc = doc(this.firestore, `patients/${patientId}/woundAssessments/${id}`);
    await updateDoc(refDoc, data);
    await this.audit.record({ action: 'wound_assessment_updated', patientId, entityType: 'woundAssessment', entityId: id });
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
