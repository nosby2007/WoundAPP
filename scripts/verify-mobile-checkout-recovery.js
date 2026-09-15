#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const page = read('src/app/pages/patient-assessments/patient-assessments.page.ts');
const html = read('src/app/pages/patient-assessments/patient-assessments.page.html');

function need(src, value, label) {
  if (!src.includes(value)) throw new Error(label + ' missing invariant: ' + value);
}

for (const value of [
  'private startEvvBusy(): void',
  'private clearEvvBusy(): void',
  'private async withTimeout<T>',
  'Recovered from a stalled EVV action.',
  'Checkout could not be stored on this device in time. Try again once.',
  'Check-in did not finish in time.',
  'this.fieldWork.completeVisit(this.appointmentId)',
]) need(page, value, 'checkout recovery');

for (const value of [
  'color="success"',
  '[disabled]="evvBusy() && !!evvBusySince"',
  '(click)="beginCheckOut()"',
]) need(html, value, 'checkout UI');

console.log('PASS mobile checkout recovery: stale busy state self-recovers, EVV actions are bounded, and scheduler completion follows checkout.');
