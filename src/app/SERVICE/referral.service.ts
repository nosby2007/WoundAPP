import { Injectable } from '@angular/core';
import { AngularFirestore, AngularFirestoreCollection } from '@angular/fire/compat/firestore';
import firebase from 'firebase/compat/app';
import { Observable, of } from 'rxjs';
import { map, shareReplay, switchMap } from 'rxjs/operators';
import { ReferralRecord } from '../referral.model';
import { TenantService } from './tenant.service';

@Injectable({ providedIn: 'root' })
export class ReferralService {
  readonly referrals$: Observable<ReferralRecord[]>;

  constructor(
    private firestore: AngularFirestore,
    private tenant: TenantService,
  ) {
    this.referrals$ = this.tenant.orgId$.pipe(
      switchMap((orgId) => {
        if (!orgId) return of([] as ReferralRecord[]);
        return this.scopedCollection(orgId).snapshotChanges().pipe(
          map((actions) => actions.map((a) => ({
            id: a.payload.doc.id,
            ...(a.payload.doc.data() as ReferralRecord),
          }))),
        );
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  async addReferral(referral: ReferralRecord): Promise<void> {
    const orgId = await this.tenant.currentOrgId();
    if (!orgId) throw new Error('Your account is not linked to an organization.');

    const now = firebase.firestore.FieldValue.serverTimestamp();
    await this.firestore.collection<ReferralRecord>('referrals').add({
      ...referral,
      orgId,
      createdAt: now,
      updatedAt: now,
    });
  }

  async updateReferral(id: string, changes: Partial<ReferralRecord>): Promise<void> {
    const { orgId, id: ignoredId, ...safeChanges } = changes as any;
    await this.firestore.collection('referrals').doc(id).update({
      ...safeChanges,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }

  private scopedCollection(orgId: string): AngularFirestoreCollection<ReferralRecord> {
    return this.firestore.collection<ReferralRecord>(
      'referrals',
      (ref) => ref.where('orgId', '==', orgId),
    );
  }
}
