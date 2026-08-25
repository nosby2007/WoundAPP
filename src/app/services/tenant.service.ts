// src/app/services/tenant.service.ts
import { Injectable } from '@angular/core';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

/**
 * Which organization the signed-in user belongs to.
 *
 * Every clinical collection in this project is scoped by `orgId`, and the
 * Firestore rules enforce it on reads as well as writes. That matters more
 * than it looks: for a LIST query Firestore does not filter out documents
 * the caller may not read -- it refuses the whole query unless the query
 * itself proves it only asks for permitted documents. An unfiltered
 * `collection(db, 'patients')` therefore returns permission-denied even
 * for a user allowed to see every patient in it, which is why the roster
 * stopped loading.
 *
 * Deliberately built on the plain modular SDK (`auth`/`db` from
 * ../firebase) rather than Angular's injected Auth/Firestore. This app
 * registers Firebase through both the compat and modular APIs, and
 * a713a49d records what happens when a service mixes injected Auth and
 * Firestore: NG0200, circular dependency in DI. patient.service.ts already
 * takes `db` straight from ../firebase for the same reason, so this
 * follows the pattern that is known to work here.
 */
@Injectable({ providedIn: 'root' })
export class TenantService {
  private cachedUid: string | null = null;
  private cachedOrgId: string | null = null;

  /**
   * The caller's organization, or null when signed out or unassigned.
   *
   * The custom claim is preferred over the user document because the rules
   * read the claim first -- agreeing with them keeps client and server
   * from disagreeing about who the caller is. The document is the fallback
   * for accounts provisioned before the claim was written.
   */
  async currentOrgId(): Promise<string | null> {
    const user = auth.currentUser;
    if (!user) {
      this.cachedUid = null;
      this.cachedOrgId = null;
      return null;
    }

    // Cached per uid, so a roster refresh does not re-read the token and
    // the user document on every pull-to-refresh.
    if (this.cachedUid === user.uid && this.cachedOrgId) {
      return this.cachedOrgId;
    }

    let orgId: string | null = null;
    try {
      const token = await user.getIdTokenResult();
      orgId = this.readOrgId(token.claims as Record<string, unknown>);
    } catch {
      orgId = null;
    }

    if (!orgId) {
      try {
        // users/{uid} is readable by its owner (allow read: if isSelf).
        const snap = await getDoc(doc(db, 'users', user.uid));
        orgId = snap.exists() ? this.readOrgId(snap.data() as Record<string, unknown>) : null;
      } catch {
        orgId = null;
      }
    }

    this.cachedUid = user.uid;
    this.cachedOrgId = orgId;
    return orgId;
  }

  /** Forgets the cache -- call on sign-out so the next user starts clean. */
  reset(): void {
    this.cachedUid = null;
    this.cachedOrgId = null;
  }

  /** Accepts the legacy spellings the rules' docOrgId() also tolerates. */
  private readOrgId(source: Record<string, unknown> | undefined): string | null {
    if (!source) return null;
    for (const key of ['orgId', 'orgID', 'tenantId', 'tenantID']) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return null;
  }
}
