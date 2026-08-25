// src/app/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { environment } from '../environments/environment';

const app = initializeApp(environment.firebase);

export const auth = getAuth(app);
export const db   = getFirestore(app);

// The PIN callables are deployed to us-central1, which is also
// getFunctions' default region -- named here anyway so a future region
// change is a one-line edit rather than a silent 404.
export const functions = getFunctions(app, 'us-central1');
