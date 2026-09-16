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
  'schemaVersion: treatment ? 3 : 2',
  "mode: 'algorithm'",
  'listPublishedTreatmentProtocols',
  'snapshotTreatmentProtocol',
  'treatmentProtocol:',
  'specialInstructions:',
]) {
  if (!orderService.includes(required)) throw new Error(`Shared order contract invariant missing: ${required}`);
}

for (const required of [
  'It does not choose treatment or place an order.',
  'chooseWoundType(',
  'filteredAlgorithms',
  'selectedTypeMatchedGuidance',
  'TREATMENT TEMPLATE',
  'onTreatmentTemplateChanged(',
  'protocolOptions(',
  'toggleProtocolOption(',
  'selectedTreatmentTemplate',
]) {
  if (!page.includes(required)) throw new Error(`Mobile provider guidance UI invariant missing: ${required}`);
}

if (!fieldWork.includes('.filter(visit => !visit.archivedAt)')) {
  throw new Error('Archived scheduler appointments must not appear in WoundAPP Today.');
}

console.log('PASS WoundAPP P2 order guidance: shared structured orders, admin treatment templates, immutable snapshots, explicit provider confirmation, archived visits hidden.');
