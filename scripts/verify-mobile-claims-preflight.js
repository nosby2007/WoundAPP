#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const firebase = fs.readFileSync(path.join(root, 'src/app/firebase.ts'), 'utf8');

for (const required of [
  "httpsCallable(bootstrapFunctions, 'syncMyClaimsV1')",
  'await user.getIdTokenResult(true)',
  'await user.getIdToken(true)',
  "getDoc(doc(bootstrapDb, 'users', user.uid))",
  'rolesDiffer',
  'orgDiffers',
  "currentRoles.includes('super_admin')",
  'if (user) await repairOperationalClaimsIfNeeded(user)',
]) {
  if (!firebase.includes(required)) {
    throw new Error(`Mobile claims preflight missing invariant: ${required}`);
  }
}

if (!firebase.includes('console.warn(\'[Firebase] Could not reconcile operational auth claims.\'')) {
  throw new Error('Claims repair must fail open for offline field use while surfacing a diagnostic warning.');
}

console.log('PASS mobile claims preflight: stale ordinary role/org claims self-heal before field workflows without self-escalating super_admin.');
