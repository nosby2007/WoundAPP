#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

const svc = read('src/app/services/clinical-document-export.service.ts');
const page = read('src/app/pages/patient-assessments/patient-assessments.page.ts');
const html = read('src/app/pages/patient-assessments/patient-assessments.page.html');

function need(src, value, label) {
  if (!src.includes(value)) throw new Error(label + ' missing invariant: ' + value);
}
function forbid(src, value, label) {
  if (src.includes(value)) throw new Error(label + ' must not contain: ' + value);
}

for (const value of [
  'private async buildVisitPacket(',
  'private belongsToVisit(',
  'Clinical Visit Record',
  'Patient face sheet',
  'Rendering clinician',
  'Encounter verification / EVV',
  'Clinical document manifest',
  'Authentication and source statement',
  'Record requires review before external release',
  'This record was compiled from chart documents explicitly linked to the selected clinical encounter.',
]) need(svc, value, 'professional visit packet');

for (const value of [
  "data.visitId",
  "data.woundVisitId",
  "data.appointmentId",
]) need(svc, value, 'visit scoping');

need(page, 'printVisitPacket(this.patientId, this.woundVisitId, this.appointmentId)', 'packet caller');
need(page, 'shareVisitPacket(this.patientId, this.woundVisitId, this.appointmentId)', 'packet caller');
need(html, 'Print clinical record', 'packet UI');
need(html, 'Visit-specific professional record for continuity of care or payer review.', 'packet UI');

const packetStart = svc.indexOf('private async buildVisitPacket(');
const packetEnd = svc.indexOf('private async buildDocument(', packetStart);
const packetBlock = svc.slice(packetStart, packetEnd);
forbid(packetBlock, 'this.renderObject(record.data)', 'visit packet');
forbid(packetBlock, 'Object.keys(value).sort()', 'visit packet');

console.log('PASS professional visit packet: encounter-scoped clinical record replaces raw Firestore object dump.');
