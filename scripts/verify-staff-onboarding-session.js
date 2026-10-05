#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const firebase = fs.readFileSync(path.join(root, 'src/app/firebase.ts'), 'utf8');
const guard = fs.readFileSync(path.join(root, 'src/app/guards/pin.guard.ts'), 'utf8');
const login = fs.readFileSync(path.join(root, 'src/app/pages/login/login.page.ts'), 'utf8');
const pin = fs.readFileSync(path.join(root, 'src/app/pages/pin/pin.page.ts'), 'utf8');
const routes = fs.readFileSync(path.join(root, 'src/app/app-routing.module.ts'), 'utf8');
const onboarding = fs.readFileSync(path.join(root, 'src/app/pages/staff-onboarding/staff-onboarding.page.ts'), 'utf8');
const onboardingHtml = fs.readFileSync(path.join(root, 'src/app/pages/staff-onboarding/staff-onboarding.page.html'), 'utf8');

const violations = [];

for (const required of [
  'browserLocalPersistence',
  'setPersistence(auth, browserLocalPersistence)',
  'authStateReady',
  'onAuthStateChanged',
]) {
  if (!firebase.includes(required)) violations.push('Firebase persistence missing: ' + required);
}

if (!guard.includes('await authStateReady')) {
  violations.push('PIN guard must wait for Firebase auth restoration before checking currentUser.');
}

if (!login.includes("navigateByUrl('/pin'")) {
  violations.push('Sign-in must route through the PIN gate.');
}

if (!pin.includes("navigateByUrl('/welcome'")) {
  violations.push('Successful sign-in PIN must route through staff onboarding.');
}

if (!pin.includes("reason === 'inactivity'") || !pin.includes('returnUrl')) {
  violations.push('Inactivity re-unlock must return staff to their active screen.');
}

if (!routes.includes("path: 'welcome'") || !routes.includes('StaffOnboardingPage')) {
  violations.push('Welcome onboarding route is missing.');
}

for (const required of [
  'Check in at the patient location',
  'Complete the Braden score',
  'Complete head-to-toe / systemic assessment',
  'Assess, photograph, and document treatment',
  'Check out and confirm the visit signature',
]) {
  if (!onboarding.includes(required)) violations.push('Onboarding visit step missing: ' + required);
}

for (const required of [
  'Welcome, {{ firstName }}',
  'Start my day',
  'message-thread',
  'ion-progress-bar',
]) {
  if (!onboardingHtml.includes(required)) violations.push('Onboarding experience missing: ' + required);
}

if (violations.length) {
  console.error('Staff onboarding/session contract failed:');
  violations.forEach((v) => console.error(' - ' + v));
  process.exit(1);
}

console.log('PASS staff onboarding/session: persisted auth, PIN gate, animated welcome, inactivity return.');
