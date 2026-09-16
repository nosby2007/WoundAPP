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
  getDoc,
  getDocs,
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


  async getLatestRawForWound(patientId: string, woundId: string): Promise<any | null> {
    const colRef = collection(this.firestore, `patients/${patientId}/woundAssessments`);
    const snapshot = await getDocs(colRef);

    const candidates = snapshot.docs
      .map((snap) => ({ ...snap.data() as any, id: snap.id }))
      .filter((data: any) => String(data?.woundId || data.id) === woundId)
      .sort((a: any, b: any) => this.assessmentTimeMs(b) - this.assessmentTimeMs(a));

    return candidates[0] ?? null;
  }

  private assessmentTimeMs(data: any): number {
    const raw = data?.assessedAt ?? data?.createdAt ?? data?.updatedAt ?? null;
    if (!raw) return 0;
    if (typeof raw?.toMillis === 'function') return raw.toMillis();
    if (typeof raw?.toDate === 'function') return raw.toDate().getTime();
    const date = raw instanceof Date ? raw : new Date(raw);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
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
    const woundId = String(payload.woundId || id);
    const now = serverTimestamp();

    let patient: any = null;
    let facilityId: string | null = null;
    if (fieldContext.newWound || fieldContext.fieldEncounterVisitId) {
      const patientSnap = await getDoc(doc(this.firestore, `patients/${patientId}`));
      if (!patientSnap.exists()) throw new Error('Patient not found.');
      patient = patientSnap.data() as any;
      facilityId = patient.facilityId ?? patient.primaryFacilityId ?? null;
    }

    const actor = {
      uid: identity.uid,
      displayName: identity.displayName,
      role: identity.role,
      credentials: identity.credentials ?? null,
      npi: identity.npi ?? null,
    };

    let episodeId: string | null = null;

    if (fieldContext.newWound) {
      // WoundAPP establishes the wound and its initial episode from actual
      // bedside findings. JADE never has to pre-create either record.
      const episodeRef = doc(collection(this.firestore, `patients/${patientId}/woundEpisodes`));
      episodeId = episodeRef.id;
      payload.episodeId = episodeId;

      batch.set(doc(this.firestore, `patients/${patientId}/wounds/${woundId}`), {
        orgId: identity.orgId,
        facilityId,
        patientId,
        label: payload.describe?.location || `Wound ${woundId.slice(0, 6)}`,
        type: payload.describe?.type || 'Other',
        stage: payload.describe?.stage || null,
        acquired: payload.describe?.acquired || null,
        location: payload.describe?.location || null,
        firstAssessmentId: id,
        latestAssessmentId: id,
        latestAssessedAt: payload.assessedAt ?? now,
        activeEpisodeId: episodeId,
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
        woundId,
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
        episodeOwnerType: identity.role === 'np' ? 'np' : null,
        fieldOpenedByRole: identity.role,
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
    } else if (fieldContext.fieldEncounterVisitId) {
      // Re-evaluations inherit the active episode for the wound when one is
      // already established. Missing provider assignment remains an explicit
      // JADE office blocker; WoundAPP never guesses it.
      const woundSnap = await getDoc(doc(this.firestore, `patients/${patientId}/wounds/${woundId}`));
      episodeId = woundSnap.exists()
        ? ((woundSnap.data() as any).activeEpisodeId ?? null)
        : null;
      if (episodeId) payload.episodeId = episodeId;
    }

    if (fieldContext.fieldEncounterVisitId) {
      const fieldVisitId = fieldContext.fieldEncounterVisitId;
      const fieldVisitRef = doc(this.firestore, `patients/${patientId}/woundVisits/${fieldVisitId}`);
      const fieldVisitSnap = await getDoc(fieldVisitRef);
      if (!fieldVisitSnap.exists()) {
        throw new Error('The active field encounter is missing. Return to the scheduled visit before saving this assessment.');
      }

      const fieldVisit = fieldVisitSnap.data() as any;
      const appointmentId = fieldContext.appointmentId || fieldVisit.appointmentId || null;
      const existingWoundId = String(fieldVisit.woundId || '').trim();

      let clinicalVisitId = fieldVisitId;

      if (!existingWoundId || existingWoundId === woundId) {
        // First wound discovered in this physical appointment: promote the
        // pre-wound field envelope into the wound-specific clinical visit.
        // This preserves the original EVV/check-in identity and avoids a
        // shadow visit.
        batch.update(fieldVisitRef, {
          woundId,
          visitScope: 'single_wound',
          episodeId: episodeId || fieldVisit.episodeId || null,
          assessmentIds: arrayUnion(id),
          fieldWoundIds: arrayUnion(woundId),
          fieldWoundVisitIds: arrayUnion(fieldVisitId),
          ...(episodeId ? { fieldEpisodeIds: arrayUnion(episodeId) } : {}),
          updatedAt: now,
          updatedBy: identity.uid,
        });
      } else {
        // A single physical appointment can include several wounds. Each
        // additional wound gets a deterministic wound-specific clinical
        // record while sharing the physical appointment/EVV source.
        clinicalVisitId = `${fieldVisitId}__${woundId}`;
        const childRef = doc(this.firestore, `patients/${patientId}/woundVisits/${clinicalVisitId}`);
        const childSnap = await getDoc(childRef);

        const childPatch: any = {
          orgId: identity.orgId,
          facilityId: fieldVisit.facilityId ?? facilityId,
          patientId,
          woundId,
          visitScope: 'single_wound',
          episodeId,
          appointmentId,
          visitType: fieldVisit.visitType || 'routine',
          status: fieldVisit.status === 'completed' ? 'completed' : 'planned',
          scheduledFor: fieldVisit.scheduledFor ?? now,
          clinicianUid: fieldVisit.clinicianUid ?? identity.uid,
          clinicianName: fieldVisit.clinicianName ?? identity.displayName,
          clinicianRole: fieldVisit.clinicianRole ?? identity.role,
          executionAuthority: 'woundapp',
          fieldEvidenceVisitId: fieldVisitId,
          fieldVisitState:
            fieldVisit.fieldVisitState === 'completed' || fieldVisit.checkOut
              ? 'completed'
              : 'on_site',
          officeDocumentationState:
            fieldVisit.fieldVisitState === 'completed' || fieldVisit.checkOut
              ? 'pending_office_documentation'
              : 'field_in_progress',
          performedByUid: fieldVisit.performedByUid ?? identity.uid,
          performedByName: fieldVisit.performedByName ?? identity.displayName,
          performedByRole: fieldVisit.performedByRole ?? identity.role,
          assessmentIds: childSnap.exists()
            ? arrayUnion(id)
            : [id],
          updatedAt: now,
          updatedBy: identity.uid,
        };

        if (!childSnap.exists()) {
          childPatch.createdAt = now;
          childPatch.createdBy = identity.uid;
        }

        batch.set(childRef, childPatch, { merge: true });
        batch.update(fieldVisitRef, {
          fieldWoundIds: arrayUnion(woundId),
          fieldWoundVisitIds: arrayUnion(clinicalVisitId),
          ...(episodeId ? { fieldEpisodeIds: arrayUnion(episodeId) } : {}),
          updatedAt: now,
          updatedBy: identity.uid,
        });
      }

      payload.visitId = clinicalVisitId;
      payload.woundVisitId = clinicalVisitId;
      payload.fieldEncounterVisitId = fieldVisitId;
      payload.appointmentId = appointmentId;
      if (episodeId) payload.episodeId = episodeId;
    }

    batch.set(assessmentRef, payload);
    await batch.commit();
    await this.audit.record({
      action: 'wound_assessment_created',
      patientId,
      entityType: 'woundAssessment',
      entityId: id,
      metadata: {
        appointmentId: fieldContext.appointmentId || null,
        fieldEncounterVisitId: fieldContext.fieldEncounterVisitId || null,
        visitId: payload.visitId || null,
        woundId,
      },
    });
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
