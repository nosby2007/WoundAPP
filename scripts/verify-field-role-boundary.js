#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const violations = [];

function setBlock(source, marker, length = 650) {
  const start = source.indexOf(marker);
  if (start < 0) {
    violations.push(`Missing field-role source marker: ${marker}`);
    return '';
  }
  return source.slice(start, start + length);
}

const policy = setBlock(
  read('src/app/services/field-role-policy.service.ts'),
  'const CLINICAL_ROLES = new Set(['
);
const scheduler = setBlock(
  read('src/app/services/mobile-scheduler.service.ts'),
  'const allowed = new Set(['
);
const routeConfig = read('src/app/tabs/tabs-routing.module.ts');
const fieldGuard = read('src/app/guards/field-access.guard.ts');
const morePage = read('src/app/pages/more/more.page.ts');
const roundsService = read('src/app/services/wound-round.service.ts');
const roundDetail = read('src/app/pages/wound-round-detail/wound-round-detail.page.ts');
const assessmentDetail = read('src/app/pages/assessments-details/assessments-details.page.ts');
const assessmentTemplate = read('src/app/pages/assessments-details/assessments-details.page.html');
const woundNote = read('src/app/shared/wound-progress-note.ts');

for (const [name, block] of [['field policy', policy], ['mobile scheduler', scheduler]]) {
  for (const orgClinicianRole of ["'rn'", "'registered_nurse'", "'nurse'"]) {
    if (!block.includes(orgClinicianRole)) {
      violations.push(`${name} must include organization clinician role ${orgClinicianRole}.`);
    }
  }
  for (const reportOnlyRole of ["'wound_nurse'", "'don'"]) {
    if (block.includes(reportOnlyRole)) {
      violations.push(`${name} must not grant field execution to report-only role ${reportOnlyRole}.`);
    }
  }
}

for (const marker of [
  'this.rolePolicy.isFacilityWoundRoundReviewer(identity)',
  "where('facilityId', 'in', facilityIds.slice(0, 30))",
]) {
  if (!roundsService.includes(marker)) {
    violations.push(`Facility wound-round query must remain facility-scoped: ${marker}`);
  }
}

for (const marker of [
  "doc(db, 'organizations', orgId, 'facilities', facilityId)",
  "where(documentId(), '==', roundId)",
  "this.rolePolicy.assignedFacilityIds(identity)",
]) {
  if (!roundsService.includes(marker)) {
    violations.push(`Facility reviewer list/detail scope is missing: ${marker}`);
  }
}

for (const marker of [
  'Review assessment',
  'reviewAssessment(p:MobileRoundPatient,assessmentId:string)',
]) {
  if (!roundDetail.includes(marker)) {
    violations.push(`Read-only linked assessment action is missing: ${marker}`);
  }
}

for (const marker of [
  "data: { access: 'wound-round-review', readOnly: true }",
  'isLinkedToAccessibleRound()',
  'patient?.assessmentIds?.includes(this.assessmentId)',
  '<ion-footer *ngIf="!readOnly">',
]) {
  if (![routeConfig, assessmentDetail, assessmentTemplate].some(source => source.includes(marker))) {
    violations.push(`Facility-scoped read-only assessment boundary is missing: ${marker}`);
  }
}

if (!/T00:00:00\(\?:\\\.0\{1,3\}\)\?Z/.test(woundNote)) {
  violations.push('ISO-midnight DOBs must be interpreted as calendar dates.');
}

for (const marker of [
  "data: { access: 'wound-round-review' }",
  'canUseWoundRoundWorkspace(identity)',
  '*ngIf="canSeeWoundRounds"',
]) {
  if (![routeConfig, fieldGuard, morePage].some(source => source.includes(marker))) {
    violations.push(`Facility wound-round review boundary is missing: ${marker}`);
  }
}

const contract = JSON.parse(read('contracts/patient-visit.shared-contract.json'));
if (contract.visit?.visitScope !== 'patient_visit') {
  violations.push('The shared visit scope must remain patient_visit.');
}
if (contract.identity?.newPhysicalVisitId !== 'visitId == appointmentId') {
  violations.push('A new physical visit must keep visitId == appointmentId.');
}
if (contract.identity?.noNewPerWoundVisits !== true) {
  violations.push('New per-wound visit records must remain disabled.');
}

if (violations.length) {
  console.error('Field role and patient-visit boundary verification failed:');
  violations.forEach((violation) => console.error(' - ' + violation));
  process.exit(1);
}

console.log('PASS field role boundary: organization nurses execute one patient visit; facility wound nurses remain scoped companions/reviewers.');
