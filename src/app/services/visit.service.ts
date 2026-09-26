// src/app/services/visit.service.ts
import { Injectable, inject } from '@angular/core';
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../firebase';

import { EvvCheckpoint, EvvLocation, EvvPatientAttestation, describeAttestationProblem } from '../shared/evv';
import { VisitLocationService } from './visit-location.service';
import { ClinicalAuditService } from './clinical-audit.service';
import {
  DurableClinicalMutationService,
  DurableJson,
} from './durable-clinical-mutation.service';

/**
 * Check in and out of a visit from the field.
 *
 * Writes `patients/{patientId}/woundVisits/{visitId}` -- the same
 * collection, same shape, same field names the web app's
 * WoundWorkflowService uses. A visit checked into here is the visit the
 * web app reports EVV gaps on and builds a submission payload from.
 *
 * WHAT THE RULES REQUIRE (firestore.rules, woundVisits):
 *   create: intakeIsWoundEvaluationAuthor() && the sub-document's orgId
 *           matches the PARENT PATIENT's orgId && patientId matches the
 *           path && requireCreatedAt() && checkIn.byUid == auth.uid
 *   update: the same author check, and a checkpoint already recorded can
 *           never be changed or removed -- by anyone.
 *
 * That last rule is why this service never rewrites a checkpoint. It is
 * also why `at` is serverTimestamp(): the device clock is recorded beside
 * it as evidence, not used as the time of record.
 *
 * Plain modular SDK (auth/db from ../firebase) rather than injected
 * Auth/Firestore, for the reason in a713a49d: mixing the two here yields
 * NG0200. patient.service.ts, tenant.service.ts and
 * progress-note.service.ts all follow the same pattern.
 */

export interface FieldVisit {
  id: string;
  patientId: string;
  visitType: string;
  status: string;
  appointmentId?: string | null;
  woundId?: string | null;
  episodeId?: string | null;
  clinicianUid?: string | null;
  clinicianName?: string | null;
  clinicianRole?: string | null;
  checkIn: EvvCheckpoint | null;
  checkOut: EvvCheckpoint | null;
}

export interface LinkedVisitContext {
  appointmentId?: string | null;
  woundVisitId?: string | null;
  woundId?: string | null;
  episodeId?: string | null;
  clinicianRole?: string | null;
}

@Injectable({ providedIn: 'root' })
export class VisitService {
  private readonly location = inject(VisitLocationService);
  private readonly audit = inject(ClinicalAuditService);
  private readonly durableMutations = inject(DurableClinicalMutationService);

  /**
   * The visit this clinician is currently on for this patient, if any.
   *
   * "Currently on" means checked in and not yet checked out. Returns null
   * otherwise -- including when a visit was completed today, because that
   * one is finished and checking out of it twice is not a thing.
   */
  async openVisit(patientId: string): Promise<FieldVisit | null> {
    const uid = auth.currentUser?.uid;
    if (!uid) return null;

    // The sub-collection is already scoped by the patient path, so the
    // rules allow this list without an orgId filter -- unlike a
    // top-level collection query, which they refuse outright.
    const snap = await getDocs(query(
      collection(db, `patients/${patientId}/woundVisits`),
      where('clinicianUid', '==', uid),
    ));

    for (const entry of snap.docs) {
      const data = entry.data() as Record<string, unknown>;
      const checkIn = (data['checkIn'] as EvvCheckpoint | undefined) ?? null;
      const checkOut = (data['checkOut'] as EvvCheckpoint | undefined) ?? null;
      if (checkIn && !checkOut) {
        return {
          id: entry.id,
          patientId,
          visitType: (data['visitType'] as string) ?? 'routine',
          status: (data['status'] as string) ?? 'planned',
          appointmentId: (data['appointmentId'] as string | null | undefined) ?? null,
          woundId: (data['woundId'] as string | null | undefined) ?? null,
          episodeId: (data['episodeId'] as string | null | undefined) ?? null,
          clinicianUid: (data['clinicianUid'] as string | null | undefined) ?? null,
          clinicianName: (data['clinicianName'] as string | null | undefined) ?? null,
          clinicianRole: (data['clinicianRole'] as string | null | undefined) ?? null,
          checkIn,
          checkOut,
        };
      }
    }
    return null;
  }

  /**
   * Record arrival, creating the visit in the same write.
   *
   * One write rather than create-then-update: a visit that exists with no
   * arrival on it is a row nobody can explain, and the create rule
   * accepts the checkpoint as long as it is attributed to the caller.
   *
   * Refuses when this clinician is already checked in to this patient --
   * an arrival happens once, and a second one would be a second visit
   * for the same presence.
   */
  /**
   * Schedule-native EVV.
   *
   * The Schedule id is the canonical physical encounter id. Check-in never
   * depends on a pre-existing woundVisit pointer and never depends on the
   * encrypted offline queue. The clinical wound records remain children of
   * this physical encounter.
   */
  async checkIn(
    patientId: string,
    visitType = 'routine',
    linked: LinkedVisitContext = {}
  ): Promise<{ visitId: string; location: EvvLocation; checkpoint: EvvCheckpoint; syncStatus: 'synced' | 'queued' }> {
    const user = auth.currentUser;
    if (!user) throw new Error('Sign in before checking in.');

    const scheduleId = String(linked.appointmentId ?? '').trim();
    if (!scheduleId) {
      throw new Error('Open this visit from Today / Schedule before checking in.');
    }

    const scheduleRef = doc(db, 'appointments', scheduleId);
    const scheduleSnap = await getDoc(scheduleRef);
    if (!scheduleSnap.exists()) throw new Error('This scheduled visit no longer exists.');

    const schedule = scheduleSnap.data() as Record<string, unknown>;
    if ((schedule['patientId'] as string | undefined) !== patientId) {
      throw new Error('This scheduled visit belongs to a different patient.');
    }
    if ((schedule['assignedToUid'] as string | undefined) !== user.uid) {
      throw new Error('Only the clinician assigned to this scheduled visit can check in.');
    }

    const location = await this.location.capture();
    const checkpoint = this.buildCheckpoint(location);
    const visitRef = doc(db, `patients/${patientId}/woundVisits/${scheduleId}`);

    await runTransaction(db, async transaction => {
      const currentSchedule = await transaction.get(scheduleRef);
      if (!currentSchedule.exists()) throw new Error('This scheduled visit no longer exists.');
      const scheduled = currentSchedule.data() as Record<string, unknown>;
      if ((scheduled['patientId'] as string | undefined) !== patientId ||
          (scheduled['assignedToUid'] as string | undefined) !== user.uid) {
        throw new Error('This scheduled visit is no longer assigned to you.');
      }

      const currentVisit = await transaction.get(visitRef);
      if (currentVisit.exists()) {
        const visit = currentVisit.data() as Record<string, unknown>;
        if (visit['checkIn']) {
          // Idempotent retry: the Schedule already has an arrival. Do not
          // manufacture another encounter or overwrite EVV evidence.
          return;
        }
        transaction.update(visitRef, {
          appointmentId: scheduleId,
          checkIn: checkpoint,
          executionAuthority: 'woundapp',
          fieldVisitState: 'on_site',
          officeDocumentationState: 'field_in_progress',
          performedByUid: user.uid,
          performedByName: user.displayName ?? null,
          performedByRole: linked.clinicianRole ?? scheduled['assignedToRole'] ?? null,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        });
      } else {
        transaction.set(visitRef, {
          orgId: scheduled['orgId'] ?? null,
          facilityId: scheduled['facilityId'] ?? null,
          patientId,
          appointmentId: scheduleId,
          visitScope: 'field_encounter',
          executionAuthority: 'woundapp',
          visitType: (scheduled['visitType'] as string | undefined) ?? visitType,
          status: 'planned',
          appointmentStatus: 'scheduled',
          fieldVisitState: 'on_site',
          officeDocumentationState: 'field_in_progress',
          clinicianUid: user.uid,
          clinicianName: user.displayName ?? scheduled['assignedToName'] ?? null,
          clinicianRole: linked.clinicianRole ?? scheduled['assignedToRole'] ?? null,
          woundId: null,
          episodeId: null,
          checkIn: checkpoint,
          checkOut: null,
          patientAttestation: null,
          performedByUid: user.uid,
          performedByName: user.displayName ?? null,
          performedByRole: linked.clinicianRole ?? scheduled['assignedToRole'] ?? null,
          createdAt: serverTimestamp(),
          createdBy: user.uid,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        });
      }

      // Schedule and physical encounter share the same deterministic id.
      // Do NOT rewrite legacy woundVisitId here. Older Schedules may retain a
      // stale non-null pointer, and Firestore intentionally makes that pointer
      // immutable for field clinicians. The Schedule id itself is canonical.
      transaction.update(scheduleRef, {
        status: 'in_progress',
        updatedAt: serverTimestamp(),
      });
    });

    void this.audit.record({
      action: 'visit_check_in',
      patientId,
      entityType: 'woundVisit',
      entityId: scheduleId,
      metadata: { scheduleId },
    }).catch(() => undefined);

    return { visitId: scheduleId, location, checkpoint, syncStatus: 'synced' };
  }

  /**
   * Record departure.
   *
   * `status` is deliberately left alone. "Checked in, not out" is already
   * expressed by checkIn && !checkOut; writing a second copy of that into
   * status would create two records of one fact, free to disagree.
   */
  async checkOut(
    patientId: string,
    visitId: string,
    attestation?: {
      method: EvvPatientAttestation['method'];
      attestedByName?: string | null;
      relationship?: string | null;
      reason?: string | null;
      electronicSignature?: EvvPatientAttestation['electronicSignature'];
    } | null
  ): Promise<{ location: EvvLocation; syncStatus: 'synced' | 'queued' }> {
    const user = auth.currentUser;
    if (!user) throw new Error('Sign in before checking out.');

    if (attestation) {
      const problem = describeAttestationProblem(
        attestation.method,
        attestation.attestedByName,
        attestation.reason,
        attestation.electronicSignature?.sha256 ?? null
      );
      if (problem) throw new Error(problem);
    }

    const location = await this.location.capture();
    const checkpoint = this.buildCheckpoint(location);
    const visitRef = doc(db, `patients/${patientId}/woundVisits/${visitId}`);

    // Checkout follows the same model as check-in: the EVV evidence is
    // committed directly to the canonical physical encounter. Browser
    // IndexedDB/durable queue availability is not a prerequisite.
    await runTransaction(db, async transaction => {
      const snap = await transaction.get(visitRef);
      if (!snap.exists()) throw new Error('The checked-in visit could not be found.');

      const visit = snap.data() as Record<string, any>;
      if (visit['patientId'] !== patientId) throw new Error('This visit belongs to a different patient.');
      if (!visit['checkIn']) throw new Error('Check in before checking out.');

      // Idempotent retry: never overwrite immutable EVV evidence.
      if (visit['checkOut']) return;

      // Keep the atomic EVV transition deliberately small. Firestore's
      // woundVisit rule has a dedicated field-clinician path; unrelated
      // workflow/provenance fields increase rule cost and can turn a valid
      // checkout into permission-denied. Those projections are reconciled
      // after the source EVV evidence is committed.
      const patch: Record<string, unknown> = {
        checkOut: checkpoint,
        status: 'completed',
        fieldVisitState: 'completed',
        fieldCompletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
        fieldCompletionSnapshot: {
          version: 1,
          immutable: true,
          source: 'woundapp',
          patientId,
          woundVisitId: visitId,
          completedByUid: user.uid,
          completedByName: user.displayName ?? null,
          deviceCompletedAtIso: new Date().toISOString(),
          checkOutLocationStatus: location.status,
          checkOutLatitude: location.latitude ?? null,
          checkOutLongitude: location.longitude ?? null,
          checkOutAccuracyMeters: location.accuracyMeters ?? null,
          attestationMethod: attestation?.method ?? null,
          attestedByName: attestation?.attestedByName?.trim() || null,
          relationship: attestation?.relationship?.trim() || null,
          signatureSha256: attestation?.electronicSignature?.sha256 ?? null,
          signatureStoragePath: attestation?.electronicSignature?.storagePath ?? null,
          sealedAt: serverTimestamp(),
        },
      };

      if (attestation) {
        patch['patientAttestation'] = {
          method: attestation.method,
          attestedByName: attestation.attestedByName?.trim() || null,
          relationship: attestation.relationship?.trim() || null,
          attestedAtIso: new Date().toISOString(),
          reason: attestation.reason?.trim() || null,
          recordedByUid: user.uid,
          recordedByName: user.displayName ?? null,
          recordedAt: serverTimestamp(),
          electronicSignature: attestation.electronicSignature
            ? {
                storagePath: attestation.electronicSignature.storagePath,
                downloadUrl: attestation.electronicSignature.downloadUrl,
                sha256: attestation.electronicSignature.sha256,
                capturedAtIso: attestation.electronicSignature.capturedAtIso,
              }
            : null,
        };
      }

      transaction.update(visitRef, patch);
    });

    // Child wound records are downstream clinical projections. Their
    // reconciliation must never keep the bedside Checkout control spinning.
    void getDoc(visitRef).then((sourceSnap) => {
      const source = sourceSnap.exists() ? sourceSnap.data() as any : null;
      const childIds: string[] = Array.isArray(source?.fieldWoundVisitIds)
        ? source.fieldWoundVisitIds.filter((id: unknown): id is string => typeof id === 'string' && !!id && id !== visitId)
        : [];
      return Promise.all(childIds.map((childId) =>
        this.durableMutations.queueUpdate({
          operation: 'wound_visit_field_complete',
          patientId,
          entityType: 'woundVisit',
          entityId: childId,
          firestorePath: `patients/${patientId}/woundVisits/${childId}`,
          payload: {
            status: 'completed',
            fieldVisitState: 'completed',
            fieldCompletedAt: DurableClinicalMutationService.serverTimestamp(),
            officeDocumentationState: 'pending_office_documentation',
            fieldEvidenceVisitId: visitId,
            updatedAt: DurableClinicalMutationService.serverTimestamp(),
            updatedBy: user.uid,
          },
        })
      ));
    }).catch((error) => {
      console.warn('[VisitService] child wound visit completion reconciliation deferred', error);
    });

    // The progress note may have been written before checkout. Once field
    // evidence is complete, promote already-filed human-reviewed note evidence
    // to office-documentation complete without mixing it into the EVV
    // transaction (which intentionally stays minimal).
    void getDocs(query(
      collection(db, `patients/${patientId}/providerNotes`),
      where('visitId', '==', visitId),
      limit(10),
    )).then((notesSnap) => {
      const hasHumanReviewedProgressNote = notesSnap.docs.some((noteDoc) => {
        const note = noteDoc.data() as any;
        const type = String(note.type || '').trim().toLowerCase();
        return note.humanReviewed !== false &&
          (!type || type === 'progress notes' || type === 'progress note');
      });
      if (!hasHumanReviewedProgressNote) return undefined;
      return this.durableMutations.enqueueUpdate({
        operation: 'visit_office_documentation_complete',
        patientId,
        entityType: 'woundVisit',
        entityId: visitId,
        firestorePath: `patients/${patientId}/woundVisits/${visitId}`,
        payload: {
          officeDocumentationState: 'complete',
          officeDocumentationCompletedAt: DurableClinicalMutationService.serverTimestamp(),
          officeDocumentationCompletedBy: user.uid,
          updatedAt: DurableClinicalMutationService.serverTimestamp(),
          updatedBy: user.uid,
        },
      });
    }).catch((error) => {
      console.warn('[VisitService] progress-note office-documentation reconciliation deferred', error);
    });

    void this.audit.record({
      action: 'visit_check_out',
      patientId,
      entityType: 'woundVisit',
      entityId: visitId,
      metadata: { attestation: !!attestation },
    }).catch(() => undefined);

    return { location, syncStatus: 'synced' };
  }

  hasPendingCheckIn(visitId: string): boolean {
    return this.durableMutations.hasPending('visit_check_in', visitId);
  }

  hasPendingCheckout(visitId: string): boolean {
    return this.durableMutations.hasPending('visit_check_out', visitId);
  }

  /**
   * Saves the actual WoundAPP clinical path on the shared woundVisit.
   * This is navigation provenance, not a claim that the clinical step was
   * completed. Completion continues to come from the real clinical documents.
   */
  async recordJourneyStep(
    patientId: string,
    woundVisitId: string | null | undefined,
    appointmentId: string | null | undefined,
    step: string,
    route: string
  ): Promise<void> {
    const user = auth.currentUser;
    if (!user || !patientId || !woundVisitId || !step) return;

    const safeStep = step.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48);
    await this.durableMutations.enqueueUpdate({
      operation: 'visit_journey_step',
      patientId,
      entityType: 'woundVisit',
      entityId: woundVisitId,
      firestorePath: `patients/${patientId}/woundVisits/${woundVisitId}`,
      payload: {
        'mobileWorkflow.appointmentId': (appointmentId ?? null) as DurableJson,
        'mobileWorkflow.currentStep': safeStep,
        'mobileWorkflow.lastRoute': route,
        'mobileWorkflow.lastUpdatedAt': DurableClinicalMutationService.serverTimestamp(),
        [`mobileWorkflow.steps.${safeStep}.enteredAt`]: DurableClinicalMutationService.serverTimestamp(),
        [`mobileWorkflow.steps.${safeStep}.byUid`]: user.uid,
        [`mobileWorkflow.steps.${safeStep}.byName`]: (user.displayName ?? null) as DurableJson,
        updatedAt: DurableClinicalMutationService.serverTimestamp(),
        updatedBy: user.uid,
      },
    });
  }

  private isOnline(): boolean {
    return typeof navigator === 'undefined' ? true : navigator.onLine;
  }

  private buildDurableCheckpoint(location: EvvLocation): DurableJson {
    const user = auth.currentUser!;
    return {
      at: DurableClinicalMutationService.serverTimestamp(),
      deviceReportedAt: new Date().toISOString(),
      clockSkewSeconds: null,
      byUid: user.uid,
      byName: user.displayName ?? null,
      byRole: null,
      location: {
        status: location.status,
        latitude: location.latitude ?? null,
        longitude: location.longitude ?? null,
        accuracyMeters: location.accuracyMeters ?? null,
        source: location.source ?? null,
        failureReason: location.failureReason ?? null,
      },
      method: 'app_capture',
      manualReason: null,
    };
  }

  private buildCheckpoint(location: EvvLocation): EvvCheckpoint {
    const user = auth.currentUser!;
    const deviceReportedAt = new Date().toISOString();
    return {
      at: serverTimestamp(),
      deviceReportedAt,
      // Deliberately null, not 0.
      //
      // The skew is the gap between the DEVICE clock and the SERVER
      // clock, and a client cannot measure it: `deviceReportedAt` and any
      // Date.now() it might compare against come from the same wrong
      // clock, so the answer is always 0 whatever the truth. Writing 0
      // here would assert "this device agrees with the server" on exactly
      // the handsets that do not.
      //
      // Both operands ARE stored -- deviceReportedAt here, and the server
      // time in `at` -- so the real skew is derived on read. Null means
      // "not measured at write time", which is the truth.
      clockSkewSeconds: null,
      byUid: user.uid,
      byName: user.displayName ?? null,
      byRole: null,
      location,
      method: 'app_capture',
      manualReason: null,
    };
  }
}