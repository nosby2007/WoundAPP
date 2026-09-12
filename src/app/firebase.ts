// src/app/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
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
export const db   = getFirestore(app);
export const storage = getStorage(app);

// The PIN callables are deployed to us-central1, which is also
// getFunctions' default region -- named here anyway so a future region
// change is a one-line edit rather than a silent 404.
export const functions = getFunctions(app, 'us-central1');
