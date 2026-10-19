#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const assert = (ok, msg) => { if (!ok) throw new Error(msg); };

const assessmentService = read('src/app/services/assessments.service.ts');
const assessmentPage = read('src/app/pages/assessment-form/assessment-form.page.ts');
const patientAssessments = read('src/app/pages/patient-assessments/patient-assessments.page.ts');
const progressNotes = read('src/app/services/progress-note.service.ts');
const progressForm = read('src/app/pages/progress-note-form/progress-note-form.page.ts');
const carePlans = read('src/app/services/care-plan.service.ts');
const education = read('src/app/services/education.service.ts');
const orders = read('src/app/services/mobile-order.service.ts');
const visitHistory = read('src/app/pages/visit-history-detail/visit-history-detail.page.ts');
const visitService = read('src/app/services/visit.service.ts');

for (const token of [
  "visitScope: 'patient_visit'",
  'woundIds: arrayUnion(woundId)',
  'fieldWoundIds: arrayUnion(woundId)',
  'fieldEpisodeIds: arrayUnion(episodeId)',
  'payload.visitId = clinicalVisitId',
  'payload.episodeId = episodeId',
  'return {',
  'episodeId: (payload.episodeId',
]) assert(assessmentService.includes(token), 'Assessment/visit linkage invariant missing: ' + token);

assert(assessmentPage.includes('const linkResult = await this.assessments.createWithId('), 'Assessment form must consume canonical link result.');
assert(assessmentPage.includes('basePayload.episodeId = linkResult.episodeId'), 'Assessment form must preserve canonical episode id.');

assert(patientAssessments.includes('contextWoundId'), 'Visit workspace must preserve wound context.');
assert(patientAssessments.includes('contextEpisodeId'), 'Visit workspace must preserve episode context.');
assert(patientAssessments.includes('encounterQueryParams()'), 'New-wound flow must use wound-neutral encounter params.');

assert(progressNotes.includes("officeDocumentationState: 'complete'"), 'Visit-scoped progress note must project office documentation complete after field completion.');
assert(progressForm.includes('this.visitLink'), 'Generic progress note must preserve visit linkage.');
assert(visitHistory.includes('woundLinksLabel') && visitHistory.includes('episodeLinksLabel'), 'Visit history must show multi-wound linkage, not singular null placeholders.');
for (const token of [
  "where('visitId', '==', visitId)",
  "where('fieldEncounterVisitId', '==', visitId)",
  "where('appointmentId', '==', visitId)",
]) assert(visitService.includes(token), 'Checkout must reconcile pre-departure progress notes by every physical-visit alias: ' + token);

assert(carePlans.includes('organizations/${orgId}/carePlanCatalog'), 'Mobile care plan must consume the org carePlanCatalog source of truth.');
assert(!carePlans.includes('carePlanTemplates'), 'Mobile care plan must not use carePlanTemplates as a second source of truth.');
assert(education.includes('organizations/${orgId}/educationTopicCatalog'), 'Education must consume the org education topic catalog.');
assert(orders.includes('organizations/${orgId}/treatmentProtocolTemplates'), 'Orders must consume the org treatment protocol template source.');

console.log('PASS full Scheduler -> WoundAPP -> visit -> wound/episode -> documentation linkage contract.');
