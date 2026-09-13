// src/app/firebase.ts
import { initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, onAuthStateChanged, setPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { environment } from '../environments/environment';

const app = initializeApp(environment.firebase);

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
 */
export const authStateReady = authPersistenceReady.then(() =>
  new Promise<void>((resolve) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      () => {
        unsubscribe();
        resolve();
      },
      () => {
        unsubscribe();
        resolve();
      }
    );
  })
);

export const db   = getFirestore(app);
export const storage = getStorage(app);

// The PIN callables are deployed to us-central1, which is also
// getFunctions' default region -- named here anyway so a future region
// change is a one-line edit rather than a silent 404.
export const functions = getFunctions(app, 'us-central1');
