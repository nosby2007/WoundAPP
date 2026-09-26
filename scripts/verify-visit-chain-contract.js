#!/usr/bin/env node
'use strict';

const fs = require('fs');
const assert = require('assert/strict');
const read = (path) => fs.readFileSync(path, 'utf8');

const assessments = read('src/app/services/assessments.service.ts');
const assessmentDetail = read('src/app/pages/assessments-details/assessments-details.page.ts');
const woundCarePlan = read('src/app/pages/wound-care-plan/wound-care-plan.page.ts');
const patientCarePlan = read('src/app/pages/patient-care-plan/patient-care-plan.page.ts');
const education = read('src/app/pages/education/education.page.ts');
const orders = read('src/app/services/mobile-order.service.ts');
const progress = read('src/app/services/progress-note.service.ts');
const progressForm = read('src/app/pages/progress-note-form/progress-note-form.page.ts');
const completeness = read('src/app/pages/visit-complete/visit-complete.page.ts');
const history = read('src/app/pages/visit-history-detail/visit-history-detail.page.ts');

for (const token of [
  "visitScope: 'patient_visit'",
  'woundIds: arrayUnion(woundId)',
  'fieldWoundIds: arrayUnion(woundId)',
  'fieldEpisodeIds: arrayUnion(episodeId)',
  'payload.visitId = clinicalVisitId',
  'payload.episodeId = episodeId',
]) assert.ok(assessments.includes(token), 'assessment→patient_visit linkage drift: ' + token);

for (const token of [
  'private visitQueryParams()',
  "params['woundVisitId']",
  "params['episodeId']",
  'queryParams: this.visitQueryParams()',
]) assert.ok(assessmentDetail.includes(token), 'assessment detail loses visit context: ' + token);

for (const token of [
  "appointmentId = this.route.snapshot.queryParamMap.get('appointmentId')",
  "woundVisitId = this.route.snapshot.queryParamMap.get('woundVisitId')",
  "episodeId = this.route.snapshot.queryParamMap.get('episodeId')",
  'fieldEncounterVisitId:',
]) assert.ok(woundCarePlan.includes(token), 'wound care plan visit linkage drift: ' + token);

assert.ok(patientCarePlan.includes("organizations/{orgId}/carePlanCatalog") || patientCarePlan.includes('CarePlanService'));
assert.ok(education.includes('episodeId: this.episodeId || null'));
assert.ok(education.includes('fieldEncounterVisitId: this.woundVisitId || null'));

for (const token of [
  "visitScope === 'patient_visit'",
  'linkedWoundIds.includes(woundId)',
  'activeEpisodeId',
  'visitId: requestedVisitId',
]) assert.ok(orders.includes(token), 'order patient_visit linkage drift: ' + token);

for (const token of [
  "officeDocumentationState: 'complete'",
  'officeDocumentationCompletedBy: identity.uid',
  'fieldEncounterVisitId || visitLink.appointmentId || visitLink.visitId',
]) assert.ok(progress.includes(token), 'progress note office-documentation projection drift: ' + token);

assert.ok(progressForm.includes('visitLink: ClinicalVisitLink = this.readVisitLink()'));
assert.ok(progressForm.includes('this.visitLink'));
assert.ok(completeness.includes('visitId: this.appointmentId || null'));
assert.ok(completeness.includes('fieldEncounterVisitId: this.appointmentId || null'));

for (const token of [
  'visit.visitScope',
  'visit.woundIds',
  'visit.fieldWoundIds',
  'visit.fieldEpisodeIds',
  'No wound assessed on this physical visit',
]) assert.ok(history.includes(token), 'visit history hides patient_visit linkage: ' + token);

console.log('PASS Scheduler → WoundAPP → patient_visit → wound/episode → documentation chain static contract.');
