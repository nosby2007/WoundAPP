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

const normalizeStringSet = (value: unknown): string[] =>
  Array.from(new Set(
    (Array.isArray(value) ? value : [])
      .filter((item): item is string => typeof item === 'string' && !!item.trim())
      .map((item) => item.trim())
      .filter(Boolean)
  )).sort();

const profileRoles = (profile: Record<string, unknown>): string[] => {
  const list = Array.isArray(profile['roles'])
    ? profile['roles'].filter((value): value is string => typeof value === 'string' && !!value.trim())
    : [];
  const single = typeof profile['role'] === 'string' && profile['role'].trim()
    ? [profile['role']]
    : [];
  return Array.from(new Set([...list, ...single].map(normalizeRole).filter(Boolean))).sort();
};

const tokenRoles = (claims: Record<string, unknown>): string[] => {
  const list = Array.isArray(claims['roles'])
    ? claims['roles'].filter((value): value is string => typeof value === 'string' && !!value.trim())
    : [];
  const single = typeof claims['role'] === 'string' && claims['role'].trim()
    ? [claims['role']]
    : [];
  return Array.from(new Set([...list, ...single].map(normalizeRole).filter(Boolean))).sort();
};

const readOrgId = (source: Record<string, unknown>): string => {
  for (const key of ['orgId', 'orgID', 'tenantId', 'tenantID']) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const sameSet = (left: string[], right: string[]): boolean =>
  left.length === right.length && left.every((value) => right.includes(value));

async function repairOperationalClaimsIfNeeded(user: User): Promise<void> {
  try {
    const [token, profileSnap] = await Promise.all([
      user.getIdTokenResult(true),
      getDoc(doc(bootstrapDb, 'users', user.uid)),
    ]);

    if (!profileSnap.exists()) return;

    const profile = profileSnap.data() as Record<string, unknown>;
    const claims = token.claims as Record<string, unknown>;

    const expectedRoles = profileRoles(profile);
    const currentRoles = tokenRoles(claims);
    const expectedOrg = readOrgId(profile);
    const currentOrg = readOrgId(claims);
    const expectedFacilityIds = normalizeStringSet(profile['facilityIds']);
    const currentFacilityIds = normalizeStringSet(claims['facilityIds']);

    // super_admin remains token-authoritative; editable profile data can never
    // bootstrap that privilege.
    const privileged = currentRoles.includes('super_admin');

    // Compare the complete operational role representation so an empty profile
    // role set correctly revokes stale token roles, and a stale singular role
    // cannot hide behind an already-current roles[] claim.
    const rolesDiffer = !sameSet(expectedRoles, currentRoles);
    const orgDiffers = expectedOrg !== currentOrg;
    const facilityIdsDiffer = !sameSet(expectedFacilityIds, currentFacilityIds);

    if (privileged || (!rolesDiffer && !orgDiffers && !facilityIdsDiffer)) return;

    const syncMyClaims = httpsCallable(bootstrapFunctions, 'syncMyClaimsV1');
    await syncMyClaims({});
    await user.getIdToken(true);
  } catch (error) {
    // A transient network/callable outage must not become a mobile lockout.
    // Server-side rules still make the final authorization decision.
    console.warn('[Firebase] Could not reconcile operational auth claims.', error);
  }
}

export const authPersistenceReady = setPersistence(auth, browserLocalPersistence)
  .catch((error) => {
    console.warn('[Firebase] Could not enable local auth persistence.', error);
  });

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
export const functions = bootstrapFunctions;
