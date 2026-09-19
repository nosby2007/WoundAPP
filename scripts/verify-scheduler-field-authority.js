#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

const visit = read('src/app/services/visit.service.ts');
const fieldWork = read('src/app/services/field-work.service.ts');
const fieldPage = read('src/app/pages/field-visit/field-visit.page.ts');
const assessments = read('src/app/services/assessments.service.ts');
const form = read('src/app/pages/assessment-form/assessment-form.page.ts');

function need(src, value, label) {
  if (!src.includes(value)) throw new Error(label + ' missing invariant: ' + value);
}
function forbid(src, value, label) {
  if (src.includes(value)) throw new Error(label + ' must not contain: ' + value);
}

for (const value of [
  "const scheduleId = String(linked.appointmentId ?? '').trim();",
  "const scheduleRef = doc(db, 'appointments', scheduleId);",
  "const visitRef = doc(db, `patients/${patientId}/woundVisits/${scheduleId}`);",
  "visitScope: 'field_encounter'",
  "executionAuthority: 'woundapp'",
  "woundId: null",
  "episodeId: null",
  "status: 'in_progress'",
]) need(visit, value, 'Schedule-native VisitService');

forbid(visit, "woundVisitId: scheduleId", 'Schedule-native legacy pointer mutation');
forbid(visit, "repairAssignedAppointmentShell(", 'Schedule-native VisitService');
forbid(visit, "if (linked.woundVisitId)", 'Schedule-native VisitService');
forbid(visit, "operation: 'visit_check_in'", 'Schedule-native VisitService check-in queue');
forbid(visit, "This visit has no Scheduler / Frontdesk appointment link", 'Schedule-native terminology');

for (const value of [
  'Next visits are created by Scheduler / Frontdesk.',
  'async scheduleNextVisit(): Promise<string>',
]) need(fieldWork, value, 'FieldWorkService');

forbid(fieldWork, "transaction.set(nextRef", 'FieldWorkService');
forbid(fieldPage, 'Create my next visit', 'Field visit UI');
need(fieldPage, 'Scheduler / Frontdesk is the only authority that creates the next appointment.', 'Field visit UI');
for (const value of [
  "this.withTimeout(",
  "30_000",
  "woundVisitId: null",
  "woundId: null",
  "episodeId: null",
  "Schedule completion reconciliation deferred",
]) need(fieldPage, value, 'Field visit EVV responsiveness');
forbid(fieldPage, "await this.durable.whenReady();", 'Field visit EVV durable-storage dependency');
forbid(fieldPage, "appointment visit linkage will retry", 'Field visit EVV pointer repair');

for (const value of [
  "sourceOfTruth: 'woundapp'",
  "patients/${patientId}/woundEpisodes",
  'fieldWoundIds: arrayUnion(woundId)',
  'needsProviderAssignment: identity.role !== \'np\'',
]) need(assessments, value, 'AssessmentsService');

for (const value of [
  "appointmentId = this.route.snapshot.queryParamMap.get('appointmentId')",
  "this.route.snapshot.queryParamMap.get('appointmentId') ||",
  "this.route.snapshot.queryParamMap.get('woundVisitId')",
  'newWound: !this.woundId',
]) need(form, value, 'Assessment form');

console.log('PASS Schedule-native EVV: Schedule id is the deterministic physical encounter, check-in does not depend on stale woundVisit pointers or durable browser storage, the field encounter remains wound-neutral, and WoundAPP keeps wound-specific child records downstream.');
