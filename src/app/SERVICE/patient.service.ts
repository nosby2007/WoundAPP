import { Injectable } from '@angular/core';
import { AngularFirestore, AngularFirestoreCollection } from '@angular/fire/compat/firestore';
import { Observable, of } from 'rxjs';
import { map, shareReplay, switchMap } from 'rxjs/operators';
import { Patient } from '../patient.model';
import { TenantService } from './tenant.service';

/**
 * Patient records, scoped to the signed-in user's organization.
 *
 * The scoping is not decoration. Firestore evaluates a list rule against
 * the QUERY, not against the documents it would return: `patients` allows
 * a list only where every document carries the caller's `orgId`, so an
 * unfiltered `collection('patients')` is refused outright -- which is
 * exactly why this screen stopped loading. Adding the `where` clause is
 * what makes the query provable, and therefore permitted.
 *
 * Writes carry `orgId` for the mirror-image reason: the create rule
 * requires the new document to land inside the caller's organization, so a
 * patient saved without it is rejected.
 */
@Injectable({
  providedIn: 'root',
})
export class PatientService {
  /** Patients in the caller's organization; empty while signed out. */
  readonly patient$: Observable<Patient[]>;

  constructor(
    private firestore: AngularFirestore,
    private tenant: TenantService,
  ) {
    this.patient$ = this.tenant.orgId$.pipe(
      switchMap((orgId) => {
        if (!orgId) return of([] as Patient[]);
        return this.scopedCollection(orgId).snapshotChanges().pipe(
          map((actions) => actions.map((a) => ({
            id: a.payload.doc.id,
            ...(a.payload.doc.data() as Patient),
          }))),
        );
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  async addPatient(patient: Patient): Promise<void> {
    const orgId = await this.tenant.currentOrgId();
    if (!orgId) {
      throw new Error(
        'Your account is not linked to an organization, so this patient cannot be saved. ' +
        'Ask an administrator to assign your organization.'
      );
    }
    await this.firestore.collection<Patient>('patients').add({ ...patient, orgId });
  }

  getPatientById(id: string): Observable<Patient | undefined> {
    return this.firestore.collection<Patient>('patients').doc(id).snapshotChanges().pipe(
      map((action) => {
        const data = action.payload.data();
        if (!data) return undefined;
        return { id: action.payload.id, ...(data as Patient) };
      }),
    );
  }

  updatePatient(id: string, item: Partial<Patient>): Promise<void> {
    // `orgId` is deliberately not sent: the update rule requires it to stay
    // exactly as stored, so re-sending it can only ever move a record out
    // of its organization or fail.
    const { orgId, ...rest } = item as Partial<Patient> & { orgId?: string };
    return this.firestore.collection<Patient>('patients').doc(id).update(rest);
  }

  deletePatient(id: string): Promise<void> {
    return this.firestore.collection<Patient>('patients').doc(id).delete();
  }

  private scopedCollection(orgId: string): AngularFirestoreCollection<Patient> {
    return this.firestore.collection<Patient>(
      'patients',
      (ref) => ref.where('orgId', '==', orgId),
    );
  }
}
