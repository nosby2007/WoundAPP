#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const durable = read('src/app/services/durable-clinical-mutation.service.ts');
const visit = read('src/app/services/visit.service.ts');
const evv = read('src/app/shared/evv.ts');
const field = read('src/app/pages/field-visit/field-visit.page.ts');
const signature = read('src/app/services/visit-signature.service.ts');
const signaturePad = read('src/app/shared/visit-signature-pad.component.ts');
const completion = read('src/app/pages/visit-complete/visit-complete.page.ts');
const syncReview = read('src/app/pages/sync-review/sync-review.page.ts');
const routes = read('src/app/tabs/tabs-routing.module.ts');
const voice = read('src/app/services/mobile-voice-note.service.ts');
const note = read('src/app/pages/wound-note/wound-note.page.ts');
const progress = read('src/app/services/progress-note.service.ts');

const violations = [];

for (const required of [
  "AES-GCM",
  "indexedDB",
  "needs_review",
  "expectedAbsentFields",
  "baseUpdatedAtMs",
  "crypto.subtle.generateKey",
  "false,",
  ".sort((a, b) => a.queuedAt - b.queuedAt)",
  "earlierMutationBlocker",
  "hasPending",
]) {
  if (!durable.includes(required)) violations.push('Durable queue missing: ' + required);
}

if (
  /\b(?:localStorage|sessionStorage)\s*\.\s*(?:setItem|getItem|removeItem|clear|key)\s*\(/.test(durable) ||
  /\b(?:localStorage|sessionStorage)\s*\[/.test(durable)
) {
  violations.push('Durable clinical mutation payloads must not use localStorage/sessionStorage APIs.');
}

// Arrival is now a Schedule-native Firestore transaction. Checkout and the
// immutable completion snapshot retain durable conflict protection.
for (const required of [
  "const scheduleId = String(linked.appointmentId ?? '').trim();",
  "await runTransaction(db, async transaction =>",
  "if (visit['checkIn'])",
  "if (visit['checkOut']) return;",
  "fieldCompletionSnapshot",
  "immutable: true",
  "DurableClinicalMutationService.serverTimestamp()",
]) {
  if (!visit.includes(required)) violations.push('Visit hardening missing: ' + required);
}
for (const operation of ["operation: 'visit_check_in'", "operation: 'visit_check_out'"]) {
  if (visit.includes(operation)) violations.push('Schedule-native EVV must not be routed through the durable mutation path: ' + operation);
}

for (const required of [
  "electronic_attestation",
  "needsSignature",
  "electronicSignature",
]) {
  if (!evv.includes(required)) violations.push('EVV electronic attestation missing: ' + required);
}

for (const required of [
  "app-visit-signature-pad",
  "visitSignatures.upload",
  "signatureDataUrl",
  "navigate(",
  "'complete'",
]) {
  if (!field.includes(required)) violations.push('Field visit completion missing: ' + required);
}

for (const required of [
  "sha256",
  "evv-signatures",
  "patientId",
  "uploadedBy",
]) {
  if (!signature.includes(required)) violations.push('Signature storage missing: ' + required);
}

if (!signaturePad.includes("toDataURL('image/png')")) {
  violations.push('Signature pad must produce an explicit PNG capture.');
}

for (const required of [
  "Visit complete",
  "Visit completeness",
  "durable.conflictCount()",
  "Return to Today",
]) {
  if (!completion.includes(required)) violations.push('Completion screen missing: ' + required);
}

if (!routes.includes("today/visit/:appointmentId/complete")) {
  violations.push('Visit completion route is missing.');
}
if (!routes.includes("path: 'sync-review'")) {
  violations.push('Sync Review route is missing.');
}

for (const required of [
  'Sync Review',
  'needs_review',
  'Server verified — remove local copy',
  'durable.retry',
  'durable.discard',
]) {
  if (!syncReview.includes(required)) violations.push('Sync Review workflow missing: ' + required);
}

for (const required of [
  "transcribeClinicalVoiceV1",
  "wound_progress_note",
  "visit_note",
]) {
  if (!voice.includes(required)) violations.push('Mobile voice service missing: ' + required);
}

for (const required of [
  "voiceDraft",
  "acceptVoiceDraft",
  "discardVoiceDraft",
  "Review the pending voice draft",
]) {
  if (!note.includes(required)) violations.push('Mobile voice review gate missing: ' + required);
}

for (const required of [
  "human_modified_voice",
  "voiceProvenance",
  "humanReviewed: true",
]) {
  if (!progress.includes(required)) violations.push('Reviewed voice provenance missing: ' + required);
}

if (violations.length) {
  console.error('Visit execution hardening contract failed:');
  violations.forEach((v) => console.error(' - ' + v));
  process.exit(1);
}

console.log('PASS visit execution hardening: transactional Schedule-native arrival/departure, idempotent EVV, signature, immutable completion snapshot, voice review.');
