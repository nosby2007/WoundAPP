#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const guidance = fs.readFileSync(path.join(root, 'src/app/shared/mobile-order-guidance.ts'), 'utf8');
const orderService = fs.readFileSync(path.join(root, 'src/app/services/mobile-order.service.ts'), 'utf8');
const page = fs.readFileSync(path.join(root, 'src/app/pages/clinical-order/clinical-order.page.ts'), 'utf8');
const fieldWork = fs.readFileSync(path.join(root, 'src/app/services/field-work.service.ts'), 'utf8');

for (const required of [
  'deriveMobileAlgorithmGuidance',
  'Compression and NPWT are never auto-suggested',
]) {
  if (!guidance.includes(required)) throw new Error(`Missing mobile guidance invariant: ${required}`);
}

for (const forbidden of ['setDoc(', 'createAlgorithmOrder(', 'MobileOrderService']) {
  if (guidance.includes(forbidden)) {
    throw new Error(`Guidance classifier must not place orders: ${forbidden}`);
  }
}

for (const required of [
  'guidance: input.guidance ?',
  'selectedTypeMatchedGuidance',
  'schemaVersion: 3',
  "mode: 'treatment_protocol'",
  'createTreatmentProtocolOrder',
  "orderType: 'wound_care_protocol'",
  'listPublishedTreatmentProtocols',
  'snapshotTreatmentProtocol',
  'treatmentProtocol:',
  'specialInstructions:',
  'MobileTreatmentRoutine',
  'startAt',
  'duration: routine.duration',
  'comments: routine.comments',
  'resolveOrderVisitLink',
  'fieldEncounterVisitId',
  'listOrders(',
]) {
  if (!orderService.includes(required)) throw new Error(`Shared order contract invariant missing: ${required}`);
}

for (const required of [
  'It does not choose treatment or place an order.',
  'chooseWoundType(',
  'treatmentCategories',
  'selectedTypeMatchedGuidance',
  'TREATMENT PROTOCOL',
  'onTreatmentTemplateChanged(',
  'protocolOptions(',
  'toggleProtocolOption(',
  'selectedTreatmentTemplate',
  'BUILD ROUTINE',
  'Wound management',
  'Frequency',
  'Start date',
  'Duration',
  'Change / PRN',
  'Provider comments / parameters',
  'Generated routine',
  'routinePreview',
  'routineWoundManagement',
  'routineFrequency',
  'routineStartDate',
  'routineDuration',
  'routineComments',
  'CURRENT ORDERS',
  'refreshOrders()',
  'Order saved and added to Current Orders',
]) {
  if (!page.includes(required)) throw new Error(`Mobile provider guidance UI invariant missing: ${required}`);
}


for (const forbidden of [
  'PUBLISHED ALGORITHM',
  'onAlgorithmChanged(',
  'selectedAlgorithm',
  'createAlgorithmOrder(',
  'PUBLISHED ALGORITHM',
]) {
  if (page.includes(forbidden)) {
    throw new Error(`Care Algorithm must not remain an executable order template in mobile UI: ${forbidden}`);
  }
}

if (orderService.includes("orderType: 'wound_care_algorithm'")) {
  throw new Error('Mobile treatment-template orders must not be stored as wound_care_algorithm.');
}


for (const forbidden of [
  'listPublishedAlgorithms()',
  'renderAlgorithm(',
  "orderType: 'wound_care_algorithm'",
]) {
  if (orderService.includes(forbidden)) {
    throw new Error(`Mobile order service must not use Care Algorithm as an executable template: ${forbidden}`);
  }
}

if (!page.includes('Wound care per specified treatment protocol/order')) {
  throw new Error('Mobile routine must use treatment-protocol terminology.');
}

if (!fieldWork.includes('.filter(visit => !visit.archivedAt)')) {
  throw new Error('Archived scheduler appointments must not appear in WoundAPP Today.');
}

console.log('PASS WoundAPP P2 order guidance: shared structured orders, admin treatment templates, immutable snapshots, explicit provider confirmation, archived visits hidden.');
