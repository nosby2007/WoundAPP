// src/app/firebase.ts
import { initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, onAuthStateChanged, setPersistence, User } from 'firebase/auth';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getStorage } from 'firebase/storage';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { environment } from '../environments/environment';

const app = initializeApp(environment.firebase);
const bootstrapDb = getFirestore(app);
const bootstrapFunctions = getFunctions(app, 'us-central1');

// App Check is enabled only when a production site key is configured. The
// public key belongs in environment config; enforcement stays server-side in
// Firebase. Leaving it blank keeps local/dev builds usable without pretending
// protection is active.
const appCheckKey = (environment as any).appCheck?.siteKey as string | undefined;
if (appCheckKey) {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(appCheckKey),
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth = getAuth(app);

const normalizeRole = (value: unknown): string =>
  String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');

const profileRoles = (profile: Record<string, unknown>): string[] => {
  const list = Array.isArray(profile['roles'])
    ? profile['roles'].filter((value): value is string => typeof value === 'string' && !!value.trim())
    : [];
  const single = typeof profile['role'] === 'string' && profile['role'].trim()
    ? [profile['role']]
    : [];
  return Array.from(new Set((list.length ? list : single).map(normalizeRole).filter(Boolean)));
};

const tokenRoles = (claims: Record<string, unknown>): string[] => {
  const list = Array.isArray(claims['roles'])
    ? claims['roles'].filter((value): value is string => typeof value === 'string' && !!value.trim())
    : [];
  const single = typeof claims['role'] === 'string' && claims['role'].trim()
    ? [claims['role']]
    : [];
  return Array.from(new Set((list.length ? list : single).map(normalizeRole).filter(Boolean)));
};

const sameSet = (left: string[], right: string[]): boolean =>
  left.length === right.length && left.every((value) => right.includes(value));

/**
 * Firestore/Storage authorization is claims-based, while the mobile shell
 * intentionally reads the operational role from users/{uid}. If an admin
 * changes a clinician from nurse -> NP (or fixes org/facility membership)
 * while the clinician still has an older persisted Firebase session, the UI
 * can correctly show the NP workspace while Firestore still sees stale
 * claims and rejects EVV check-in with "Missing or insufficient permissions".
 *
 * syncMyClaimsV1 is a guarded server callable that re-stamps ordinary role,
 * org and facility claims from the caller's own user profile. It explicitly
 * refuses self-escalation to super_admin. We invoke it only when the profile
 * and token disagree, then force-refresh the ID token before guards/services
 * continue.
 *
 * Network failure does not prevent offline field use; the durable clinical
 * queue can still capture work and retry after connectivity returns.
 */
async function repairOperationalClaimsIfNeeded(user: User): Promise<void> {
  try {
    const [token, profileSnap] = await Promise.all([
      user.getIdTokenResult(true),
      getDoc(doc(bootstrapDb, 'users', user.uid)),
    ]);

    if (!profileSnap.exists()) return;
    const profile = profileSnap.data() as Record<string, unknown>;
    const expectedRoles = profileRoles(profile);
    const currentRoles = tokenRoles(token.claims as Record<string, unknown>);
    const expectedOrg = typeof profile['orgId'] === 'string' ? profile['orgId'].trim() : '';
    const currentOrg = typeof token.claims['orgId'] === 'string'
      ? String(token.claims['orgId']).trim()
      : '';

    // super_admin remains token-authoritative. The callable also enforces
    // that boundary, but avoiding an unnecessary self-sync keeps startup
    // quiet for privileged accounts whose editable profile is only a mirror.
    const privileged = currentRoles.includes('super_admin');
    const rolesDiffer = expectedRoles.length > 0 && !sameSet(expectedRoles, currentRoles);
    const orgDiffers = !!expectedOrg && expectedOrg !== currentOrg;

    if (privileged || (!rolesDiffer && !orgDiffers)) return;

    const syncMyClaims = httpsCallable(bootstrapFunctions, 'syncMyClaimsV1');
    await syncMyClaims({});
    await user.getIdToken(true);
  } catch (error) {
    // Do not convert a transient network/callable outage into an application
    // lockout. Online clinical writes will still receive Firestore's normal
    // authorization verdict; offline writes remain queued and replayable.
    console.warn('[Firebase] Could not reconcile operational auth claims.', error);
  }
}

/**
 * Keep the Firebase account session across browser/app refreshes.
 * Clinical unlock freshness remains separate in SessionSecurityService, so
 * restoring Firebase Auth never bypasses the PIN/inactivity gate.
 */
export const authPersistenceReady = setPersistence(auth, browserLocalPersistence)
  .catch((error) => {
    console.warn('[Firebase] Could not enable local auth persistence.', error);
  });

/**
 * Guards must wait for Firebase to finish restoring the persisted account.
 * Reading auth.currentUser synchronously during boot can briefly return null
 * and incorrectly send an authenticated clinician back to /login.
 *
 * The same gate also reconciles stale role/org claims before a clinician can
 * enter the field workspace, preventing profile-vs-token permission drift.
 */
export const authStateReady = authPersistenceReady.then(() =>
  new Promise<void>((resolve) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        unsubscribe();
        if (user) await repairOperationalClaimsIfNeeded(user);
        resolve();
      },
      () => {
        unsubscribe();
        resolve();
      }
    );
  })
);

export const db = bootstrapDb;
export const storage = getStorage(app);

// The PIN callables are deployed to us-central1, which is also
// getFunctions' default region -- named here anyway so a future region
// change is a one-line edit rather than a silent 404.
export const functions = bootstrapFunctions;
