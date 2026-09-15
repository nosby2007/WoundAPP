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
  "This scheduled appointment is missing its clinical visit shell. Return it to Scheduler / Frontdesk for repair before check-in.",
  "operation: 'visit_check_in'",
]) need(visit, value, 'VisitService');

forbid(visit, "operation: 'visit_check_in_legacy_create'", 'VisitService');
forbid(visit, "addDoc(collection(db, `patients/${patientId}/woundVisits`", 'VisitService');

for (const value of [
  'Next visits are created by Scheduler / Frontdesk.',
  'async scheduleNextVisit(): Promise<string>',
]) need(fieldWork, value, 'FieldWorkService');

forbid(fieldWork, "transaction.set(nextRef", 'FieldWorkService');
forbid(fieldPage, 'Create my next visit', 'Field visit UI');
need(fieldPage, 'Scheduler / Frontdesk is the only authority that creates the next appointment.', 'Field visit UI');

for (const value of [
  "sourceOfTruth: 'woundapp'",
  "patients/${patientId}/woundEpisodes",
  'fieldWoundIds: arrayUnion(id)',
  'needsProviderAssignment: identity.role !== \'np\'',
]) need(assessments, value, 'AssessmentsService');

for (const value of [
  "appointmentId = this.route.snapshot.queryParamMap.get('appointmentId')",
  "fieldEncounterVisitId = this.route.snapshot.queryParamMap.get('woundVisitId')",
  'newWound: !this.woundId',
]) need(form, value, 'Assessment form');

console.log('PASS scheduler-field authority: mobile consumes scheduled appointments, creates no future appointment, and WoundAPP establishes new wound/episode source data from the field assessment.');
