// src/app/services/visit.service.ts
import { Injectable, inject } from '@angular/core';
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../firebase';

import { EvvCheckpoint, EvvLocation, EvvPatientAttestation, describeAttestationProblem } from '../shared/evv';
import { VisitLocationService } from './visit-location.service';
import { ClinicalAuditService } from './clinical-audit.service';

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
  async checkIn(
    patientId: string,
    visitType = 'routine',
    linked: LinkedVisitContext = {}
  ): Promise<{ visitId: string; location: EvvLocation }> {
    const user = auth.currentUser;
    if (!user) throw new Error('Sign in before checking in.');

    const already = await this.openVisit(patientId);
    if (already) throw new Error('You are already checked in to this patient.');

    const patientSnap = await getDoc(doc(db, 'patients', patientId));
    if (!patientSnap.exists()) throw new Error('Patient not found.');
    const patient = patientSnap.data() as Record<string, unknown>;
    const orgId = (patient['orgId'] as string) ?? (patient['orgID'] as string) ?? null;
    if (!orgId) throw new Error('This patient record carries no organization; a visit cannot be scoped to it.');

    const location = await this.location.capture();
    const checkpoint = this.buildCheckpoint(location);

    // Preferred path: JADE Episode Control / scheduler already created the
    // woundVisit and appointment atomically. WoundAPP checks into THAT SAME
    // clinical visit instead of creating a duplicate shadow encounter.
    if (linked.woundVisitId) {
      const visitRef = doc(db, `patients/${patientId}/woundVisits/${linked.woundVisitId}`);
      const visitSnap = await getDoc(visitRef);
      if (!visitSnap.exists()) {
        throw new Error('The linked wound visit no longer exists. Refresh the appointment before checking in.');
      }
      const existing = visitSnap.data() as Record<string, unknown>;
      if ((existing['patientId'] as string | undefined) !== patientId) {
        throw new Error('The linked wound visit belongs to a different patient.');
      }
      if (existing['checkIn']) {
        throw new Error('This linked visit already has an arrival recorded.');
      }

      await updateDoc(visitRef, {
        appointmentId: linked.appointmentId ?? existing['appointmentId'] ?? null,
        woundId: linked.woundId ?? existing['woundId'] ?? null,
        episodeId: linked.episodeId ?? existing['episodeId'] ?? null,
        visitType: (existing['visitType'] as string | undefined) ?? visitType,
        clinicianUid: user.uid,
        clinicianName: user.displayName ?? (existing['clinicianName'] as string | null | undefined) ?? null,
        clinicianRole: linked.clinicianRole ?? (existing['clinicianRole'] as string | null | undefined) ?? null,
        checkIn: checkpoint,
        executionAuthority: 'woundapp',
        fieldVisitState: 'on_site',
        officeDocumentationState: 'field_in_progress',
        performedByUid: user.uid,
        performedByName: user.displayName ?? null,
        performedByRole: linked.clinicianRole ?? (existing['clinicianRole'] as string | null | undefined) ?? null,
        'mobileWorkflow.appointmentId': linked.appointmentId ?? existing['appointmentId'] ?? null,
        'mobileWorkflow.currentStep': 'check_in',
        'mobileWorkflow.lastRoute': linked.appointmentId ? '/tabs/today/visit/' + linked.appointmentId : '/tabs/skin-wound/' + patientId + '/assessments',
        'mobileWorkflow.lastUpdatedAt': serverTimestamp(),
        'mobileWorkflow.steps.check_in.enteredAt': serverTimestamp(),
        'mobileWorkflow.steps.check_in.byUid': user.uid,
        'mobileWorkflow.steps.check_in.byName': user.displayName ?? null,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      });

      await this.audit.record({ action: 'visit_check_in', patientId, entityType: 'woundVisit', entityId: linked.woundVisitId, metadata: { appointmentId: linked.appointmentId ?? null } });
      return { visitId: linked.woundVisitId, location };
    }

    // Legacy/manual chart entry with no scheduler linkage. Kept only for
    // backward compatibility; new Episode Control and field follow-ups carry
    // woundVisitId so they use the branch above.
    const created = await addDoc(collection(db, `patients/${patientId}/woundVisits`), {
      orgId,
      facilityId: (patient['facilityId'] as string) ?? null,
      patientId,
      woundId: linked.woundId ?? null,
      episodeId: linked.episodeId ?? null,
      appointmentId: linked.appointmentId ?? null,
      visitType,
      status: 'planned',
      scheduledFor: Timestamp.fromDate(new Date()),
      clinicianUid: user.uid,
      clinicianName: user.displayName ?? null,
      clinicianRole: linked.clinicianRole ?? null,
      checkIn: checkpoint,
      executionAuthority: 'woundapp',
      fieldVisitState: 'on_site',
      officeDocumentationState: 'field_in_progress',
      performedByUid: user.uid,
      performedByName: user.displayName ?? null,
      performedByRole: linked.clinicianRole ?? null,
      mobileWorkflow: {
        appointmentId: linked.appointmentId ?? null,
        currentStep: 'check_in',
        lastRoute: '/tabs/skin-wound/' + patientId + '/assessments',
        lastUpdatedAt: serverTimestamp(),
        steps: {
          check_in: {
            enteredAt: serverTimestamp(),
            byUid: user.uid,
            byName: user.displayName ?? null,
          },
        },
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: user.uid,
      updatedBy: user.uid,
    });

    await this.audit.record({ action: 'visit_check_in', patientId, entityType: 'woundVisit', entityId: created.id });
    return { visitId: created.id, location };
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
    } | null
  ): Promise<{ location: EvvLocation }> {
    const user = auth.currentUser;
    if (!user) throw new Error('Sign in before checking out.');

    // Refused rather than stored half-formed: a verbal attestation with
    // nobody named is not an attestation, and an "unable to attest" with
    // no reason says nothing an auditor could use.
    if (attestation) {
      const problem = describeAttestationProblem(
        attestation.method, attestation.attestedByName, attestation.reason
      );
      if (problem) throw new Error(problem);
    }

    const location = await this.location.capture();
    const patch: Record<string, unknown> = {
      checkOut: this.buildCheckpoint(location),
      status: 'completed',
      completedAt: serverTimestamp(),
      executionAuthority: 'woundapp',
      fieldVisitState: 'completed',
      fieldCompletedAt: serverTimestamp(),
      officeDocumentationState: 'pending_office_documentation',
      performedByUid: user.uid,
      performedByName: user.displayName ?? null,
      'mobileWorkflow.currentStep': 'check_out',
      'mobileWorkflow.lastUpdatedAt': serverTimestamp(),
      'mobileWorkflow.steps.check_out.enteredAt': serverTimestamp(),
      'mobileWorkflow.steps.check_out.byUid': user.uid,
      'mobileWorkflow.steps.check_out.byName': user.displayName ?? null,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    };

    // Written only when there is one. An ABSENT attestation means nobody
    // was asked, which is a reportable state -- it must never be filled
    // in with an implied 'not_required'.
    if (attestation) {
      patch['patientAttestation'] = {
        method: attestation.method,
        attestedByName: (attestation.attestedByName ?? '').trim() || null,
        relationship: (attestation.relationship ?? '').trim() || null,
        attestedAtIso: new Date().toISOString(),
        reason: (attestation.reason ?? '').trim() || null,
        recordedByUid: user.uid,
        recordedByName: user.displayName ?? null,
        recordedAt: serverTimestamp(),
      } satisfies EvvPatientAttestation;
    }

    await updateDoc(doc(db, `patients/${patientId}/woundVisits/${visitId}`), patch);
    await this.audit.record({ action: 'visit_check_out', patientId, entityType: 'woundVisit', entityId: visitId, metadata: { attestation: !!attestation } });
    return { location };
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
    await updateDoc(doc(db, `patients/${patientId}/woundVisits/${woundVisitId}`), {
      'mobileWorkflow.appointmentId': appointmentId ?? null,
      'mobileWorkflow.currentStep': safeStep,
      'mobileWorkflow.lastRoute': route,
      'mobileWorkflow.lastUpdatedAt': serverTimestamp(),
      [`mobileWorkflow.steps.${safeStep}.enteredAt`]: serverTimestamp(),
      [`mobileWorkflow.steps.${safeStep}.byUid`]: user.uid,
      [`mobileWorkflow.steps.${safeStep}.byName`]: user.displayName ?? null,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    });
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
