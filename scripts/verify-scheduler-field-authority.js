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
  "if (linked.woundVisitId)",
  "if (linked.appointmentId)",
  "repairAssignedAppointmentShell(",
  "assignedToUid",
  "const deterministicVisitId = appointmentId;",
  "visitScope: 'field_encounter'",
  "executionAuthority: 'woundapp'",
  "operation: 'visit_check_in'",
]) need(visit, value, 'VisitService');

for (const value of [
  "if (!visitSnap.exists()) {\n        if (!linked.appointmentId)",
  "const repairedVisitId = existingPointer || deterministicVisitId;",
  "woundVisits/${repairedVisitId}",
  "woundId: null",
  "episodeId: null",
  "if (!existingPointer) {",
  "return repairedVisitId;",
]) need(visit, value, 'VisitService deterministic scheduled-visit repair');

forbid(visit, "operation: 'visit_check_in_legacy_create'", 'VisitService');
forbid(visit, "addDoc(collection(db, `patients/${patientId}/woundVisits`", 'VisitService');
forbid(visit, "if (existingPointer) return existingPointer;", 'VisitService deterministic scheduled-visit repair');
need(visit, "This visit has no Scheduler / Frontdesk appointment link and cannot be checked in.", 'VisitService unscheduled guard');

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
  "appointment visit linkage will retry",
  "post-check-in status refresh deferred",
]) need(fieldPage, value, 'Field visit EVV responsiveness');

for (const value of [
  "sourceOfTruth: 'woundapp'",
  "patients/${patientId}/woundEpisodes",
  'fieldWoundIds: arrayUnion(woundId)',
  'needsProviderAssignment: identity.role !== \'np\'',
]) need(assessments, value, 'AssessmentsService');

for (const value of [
  "appointmentId = this.route.snapshot.queryParamMap.get('appointmentId')",
  "fieldEncounterVisitId = this.route.snapshot.queryParamMap.get('woundVisitId')",
  'newWound: !this.woundId',
]) need(form, value, 'Assessment form');

console.log('PASS scheduler-field authority: mobile consumes scheduled appointments, repairs missing linked encounter shells at the existing pointer, keeps the physical field encounter wound-neutral, creates no future appointment, and WoundAPP establishes wound-specific child records from the field assessment.');
