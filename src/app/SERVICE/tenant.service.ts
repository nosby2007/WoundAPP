import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable, from, of } from 'rxjs';
import { map, shareReplay, switchMap } from 'rxjs/operators';

/**
 * Which organization the signed-in user belongs to.
 *
 * Every clinical collection in this project is scoped by `orgId`, and the
 * Firestore rules enforce it on reads as well as writes. That matters more
 * than it looks: for a LIST query Firestore does not filter out documents
 * the caller may not read -- it refuses the whole query unless the query
 * itself proves it only asks for permitted documents. An unfiltered
 * `collection('patients')` therefore returns permission-denied even for a
 * user who is allowed to see every patient in it. This service is what
 * lets the queries carry that proof.
 *
 * The custom claim is preferred over the user document because rules read
 * the claim first, so agreeing with them keeps the client and the server
 * from disagreeing about who the caller is. The document is the fallback
 * for accounts provisioned before the claim was written.
 */
@Injectable({ providedIn: 'root' })
export class TenantService {
  /** null when signed out, or when the account has no organization yet. */
  readonly orgId$: Observable<string | null>;

  constructor(
    private afAuth: AngularFireAuth,
    private afs: AngularFirestore,
  ) {
    this.orgId$ = this.afAuth.idTokenResult.pipe(
      switchMap((token) => {
        if (!token) return of(null);

        const claim = this.readOrgId(token.claims);
        if (claim) return of(claim);

        const uid = token.claims['user_id'] || token.claims['sub'];
        if (!uid) return of(null);

        // `users/{uid}` is readable by its owner (allow read: if isSelf).
        return this.afs.doc(`users/${uid}`).valueChanges().pipe(
          map((doc: any) => this.readOrgId(doc || {})),
        );
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  /** Resolves once, for the write paths that need a value rather than a stream. */
  currentOrgId(): Promise<string | null> {
    return new Promise((resolve) => {
      const sub = this.orgId$.subscribe({
        next: (orgId) => { resolve(orgId); sub.unsubscribe(); },
        error: () => { resolve(null); sub.unsubscribe(); },
      });
    });
  }

  /** Accepts the legacy spellings the rules' docOrgId() also tolerates. */
  private readOrgId(source: Record<string, any>): string | null {
    for (const key of ['orgId', 'orgID', 'tenantId', 'tenantID']) {
      const value = source?.[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return null;
  }
}
