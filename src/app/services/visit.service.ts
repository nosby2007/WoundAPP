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

import { EvvCheckpoint, EvvLocation } from '../shared/evv';
import { VisitLocationService } from './visit-location.service';

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
  checkIn: EvvCheckpoint | null;
  checkOut: EvvCheckpoint | null;
}

@Injectable({ providedIn: 'root' })
export class VisitService {
  private readonly location = inject(VisitLocationService);

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
  async checkIn(patientId: string, visitType = 'routine'): Promise<{ visitId: string; location: EvvLocation }> {
    const user = auth.currentUser;
    if (!user) throw new Error('Sign in before checking in.');

    const already = await this.openVisit(patientId);
    if (already) throw new Error('You are already checked in to this patient.');

    // The sub-document's orgId must equal the PARENT patient's, not the
    // caller's: patientSubdocOrgMatchesParent() compares them, and a
    // clinician covering a patient in another org would otherwise write a
    // row the rules refuse.
    const patientSnap = await getDoc(doc(db, 'patients', patientId));
    if (!patientSnap.exists()) throw new Error('Patient not found.');
    const patient = patientSnap.data() as Record<string, unknown>;
    const orgId = (patient['orgId'] as string) ?? (patient['orgID'] as string) ?? null;
    if (!orgId) throw new Error('This patient record carries no organization; a visit cannot be scoped to it.');

    const location = await this.location.capture();
    const checkpoint = this.buildCheckpoint(location);

    const created = await addDoc(collection(db, `patients/${patientId}/woundVisits`), {
      orgId,
      facilityId: (patient['facilityId'] as string) ?? null,
      patientId,
      visitType,
      status: 'planned',
      scheduledFor: Timestamp.fromDate(new Date()),
      clinicianUid: user.uid,
      clinicianName: user.displayName ?? null,
      checkIn: checkpoint,
      // checkOut is OMITTED, not written as null. A null puts the key in
      // the document, and the rules' checkpoint guard then reads .byUid
      // off it -- an error, not a false, so the whole write was refused.
      // Absent is also the honest shape: the departure has not happened.
      // JADE-SHOP made the rule null-tolerant as well; this side simply
      // stops creating the null.
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: user.uid,
      updatedBy: user.uid,
    });

    return { visitId: created.id, location };
  }

  /**
   * Record departure.
   *
   * `status` is deliberately left alone. "Checked in, not out" is already
   * expressed by checkIn && !checkOut; writing a second copy of that into
   * status would create two records of one fact, free to disagree.
   */
  async checkOut(patientId: string, visitId: string): Promise<{ location: EvvLocation }> {
    const user = auth.currentUser;
    if (!user) throw new Error('Sign in before checking out.');

    const location = await this.location.capture();
    await updateDoc(doc(db, `patients/${patientId}/woundVisits/${visitId}`), {
      checkOut: this.buildCheckpoint(location),
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    });
    return { location };
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
