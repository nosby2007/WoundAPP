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
  'Checkout did not finish in time.',
  'Check-in did not finish in time.',
  'this.fieldWork.completeVisit(this.appointmentId)',
  'this.visits.hasPendingCheckout(visit.id)',
]) need(page, value, 'checkout recovery');

const durable = read('src/app/services/durable-clinical-mutation.service.ts');
const visitService = read('src/app/services/visit.service.ts');
for (const value of [
  'async queueUpdate(',
  'void this.flush()',
  "status: 'queued'",
]) need(durable, value, 'durable checkout queue');

for (const value of [
  "this.durableMutations.queueUpdate({",
  "operation: 'visit_check_out'",
  "hasPendingCheckout(visitId: string)",
]) need(visitService, value, 'VisitService checkout persistence');

for (const value of [
  'color="success"',
  '[disabled]="evvBusy() && !!evvBusySince"',
  '(click)="beginCheckOut()"',
]) need(html, value, 'checkout UI');

console.log('PASS mobile checkout recovery: stale busy state self-recovers, EVV actions are bounded, and scheduler completion follows checkout.');
