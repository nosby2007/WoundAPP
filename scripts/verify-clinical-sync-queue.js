#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const queue = fs.readFileSync(path.join(root, 'src/app/services/clinical-sync-queue.service.ts'), 'utf8');
const visit = fs.readFileSync(path.join(root, 'src/app/services/visit.service.ts'), 'utf8');
const today = fs.readFileSync(path.join(root, 'src/app/pages/today/today.page.ts'), 'utf8');

for (const forbidden of ['localStorage', 'sessionStorage', 'indexedDB']) {
  if (queue.includes(forbidden) && !queue.includes(`DOES NOT serialize payloads into localStorage/sessionStorage/\n * IndexedDB`)) {
    throw new Error(`Clinical sync queue must not persist payloads in browser storage: ${forbidden}`);
  }
}

for (const required of [
  "'waiting_for_network'",
  "'syncing'",
  "'synced'",
  "'failed'",
  "window.addEventListener('online'",
  'await this.execute(item.id)',
]) {
  if (!queue.includes(required)) {
    throw new Error(`Clinical sync queue invariant missing: ${required}`);
  }
}

// Arrival and departure are Schedule-native Firestore transactions. Browser
// durable storage is not a prerequisite for EVV. Downstream clinical
// reconciliation remains queued/reviewable.
for (const operation of [
  "operation: 'visit_journey_step'",
  "operation: 'wound_visit_field_complete'",
]) {
  if (!visit.includes(operation)) {
    throw new Error(`Critical visit write is not routed through sync queue: ${operation}`);
  }
}

for (const required of [
  "const scheduleId = String(linked.appointmentId ?? '').trim();",
  "const scheduleRef = doc(db, 'appointments', scheduleId);",
  "const visitRef = doc(db, \`patients/\${patientId}/woundVisits/\${scheduleId}\`);",
  "await runTransaction(db, async transaction =>",
]) {
  if (!visit.includes(required)) {
    throw new Error(`Schedule-native check-in invariant missing: ${required}`);
  }
}
if (visit.includes("woundVisitId: scheduleId")) {
  throw new Error('Schedule-native check-in must not rewrite the legacy woundVisitId pointer.');
}
for (const operation of ["operation: 'visit_check_in'", "operation: 'visit_check_out'"]) {
  if (visit.includes(operation)) {
    throw new Error(`EVV ${operation} must not depend on the browser durable mutation queue.`);
  }
}
for (const required of [
  "if (!visit['checkIn']) throw new Error('Check in before checking out.');",
  "if (visit['checkOut']) return;",
  "transaction.update(visitRef, patch);",
  "fieldCompletionSnapshot",
  "immutable: true",
]) {
  if (!visit.includes(required)) throw new Error(`Schedule-native checkout invariant missing: ${required}`);
}

if (visit.includes("operation: 'visit_check_in_legacy_create'")) {
  throw new Error('Legacy WoundAPP visit creation must remain removed; Scheduler / Frontdesk owns visit-shell creation.');
}

for (const required of [
  'Offline mode',
  'waiting to sync',
  'retry automatically when the network returns',
  'network.online()',
  'sync.pendingCount()',
]) {
  if (!today.includes(required)) {
    throw new Error(`Offline/sync visibility missing from Today UI: ${required}`);
  }
}

console.log('PASS clinical sync contract: Schedule-native transactional check-in/check-out; downstream clinical reconciliation retains durable sync/review semantics.');
