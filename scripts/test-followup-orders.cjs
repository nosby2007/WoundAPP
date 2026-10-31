'use strict';
// Isolated production-method tests with synthetic Firestore; no patient writes.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, imports = {}) {
  const output = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, experimentalDecorators: true },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, require: name => imports[name] || {},
    Date, console, setTimeout, clearTimeout });
  return module.exports;
}
const links = load('src/app/shared/clinical-visit-link.ts');
const active = load('src/app/shared/active-orders.ts', { './clinical-visit-link': links });
const template = { id: 't1', orgId: 'o1', active: true, version: 1, name: 'Synthetic protocol', category: 'wet', orderDefaults: {}, sections: {} };
const routine = { woundManagement: 'Documented care', specialInstructions: [], cleanse: ['Original'], prep: [], fillApply: [], cover: [], secureWith: [], frequency: 'Daily', startDate: null, duration: 'Until discontinued', changePrn: [], comments: null };
function fixture(role = 'np') {
  let previous;
  let rows = [];
  const writes = [], audits = [];
  const firebase = {
    collection: (_, p) => ({ path: p }),
    doc: (base, p) => ({ path: p || `${base.path}/new1`, id: p ? p.split('/').pop() : 'new1' }),
    serverTimestamp: () => 'server-time', Timestamp: { now: () => 'now', fromDate: d => d },
    getDocs: async () => ({ docs: rows.map(r => ({ id: r.id, data: () => r })) }),
    runTransaction: async (_, callback) => {
      const pending = [];
      await callback({ get: async () => ({ data: () => previous }),
        update: (ref, data) => pending.push({ kind: 'update', ref, data }),
        set: (ref, data) => pending.push({ kind: 'set', ref, data }) });
      writes.push(...pending);
    },
  };
  const { MobileOrderService } = load('src/app/services/mobile-order.service.ts', {
    '@angular/core': { Injectable: () => x => x }, 'firebase/firestore': firebase,
    '../firebase': { auth: { currentUser: { uid: 'actor' } }, db: {} },
    '../shared/active-orders': active, '../shared/clinical-visit-link': links,
  });
  const service = Object.create(MobileOrderService.prototype);
  service.identity = { requireCurrentIdentity: async () => ({ uid: 'actor', role }) };
  service.tenant = { currentOrgId: async () => 'o1' };
  service.audit = { record: async value => audits.push(value) };
  const input = { treatmentProtocol: template, selectedCategory: 'wet', woundId: 'w1', receiptMethod: 'direct', routine: { ...routine } };
  const old = { id: 'old', orgId: 'o1', patientId: 'p1', woundId: 'w1', visitId: 'prior',
    status: 'active', esign: { signed: true }, locked: true, description: 'Original signed text',
    treatmentProtocol: service.snapshotTreatmentProtocol(template), clinical: { woundManagement: routine.woundManagement,
      specialInstructions: [], cleanse: ['Original'], prep: [], apply: [], cover: [], secure: [], comments: null,
      schedule: { frequency: 'Daily', duration: 'Until discontinued', prn: [] } } };
  previous = old;
  return { service, writes, audits, input, old, setPrevious: v => previous = v, setRows: v => rows = v };
}
test('prior visit orders remain visible, stopped/expired orders and another wound do not', async () => {
  const f = fixture();
  f.setRows([f.old, { ...f.old, id: 'other', woundId: 'w2' }, { ...f.old, id: 'stop', status: 'discontinued' },
    { ...f.old, id: 'expired', expiresAt: '2020-01-01' }]);
  const rows = await f.service.listOrders('p1', { visitId: 'new-visit', woundId: 'w1' });
  assert.deepEqual(Array.from(rows, r => r.id), ['old']);
});
test('all inactive lifecycle forms excluded and explicit episode isolation retained', () => {
  for (const state of ['discontinued','completed','cancelled','archived','declined','superseded']) {
    assert.equal(active.isCurrentOrder({ workflow: { state } }), false);
    assert.equal(active.isCurrentOrder({ status: state }), false);
  }
  assert.equal(active.isCurrentOrder({ coSignature: { status: 'declined' } }), false);
  assert.equal(active.isCurrentOrder({ clinical: { schedule: { startAt: '2099-01-01' } } }), false);
  assert.equal(active.orderAppliesToWound({ woundId: 'w1', episodeId: 'old' }, 'w1', 'new'), false);
});
test('encounter completion can use an ongoing order for its assessed wound, not an unrelated one', () => {
  assert.equal(active.orderAppliesToEncounter({ woundId: 'w1', visitId: 'prior' }, { visitId: 'now' }, ['w1']), true);
  assert.equal(active.orderAppliesToEncounter({ woundId: 'w2', visitId: 'prior' }, { visitId: 'now' }, ['w1']), false);
});
test('continue existing orders writes only review audit, never an order', async () => {
  const f = fixture('rn'); f.setRows([f.old]);
  await f.service.continueExistingOrders('p1', { woundId: 'w1', visitId: 'new' });
  assert.equal(f.writes.length, 0); assert.equal(f.audits[0].action, 'orders_reviewed_unchanged');
});
test('replacement is atomic and leaves signed content and encounter attribution unchanged', async () => {
  const f = fixture();
  await f.service.createTreatmentProtocolOrder('p1', { ...f.input, routine: { ...routine, frequency: 'BID' },
    replacesOrderId: 'old', changeReason: 'Documented change', expectedOrderFingerprint: active.orderEditFingerprint(f.old) });
  assert.equal(f.writes.length, 3);
  const stopped = f.writes.find(w => w.kind === 'update').data;
  assert.equal(stopped.status, 'discontinued');
  for (const key of ['esign','locked','clinical','description','visitId','woundId']) assert.equal(key in stopped, false);
  assert.equal(f.writes.find(w => w.ref.path.includes('/orders/') && w.kind === 'set').data.replacesOrderId, 'old');
  assert.equal(f.writes.find(w => w.ref.path.startsWith('clinicalAuditEvents/')).data.action, 'order_replaced');
});
test('unchanged care plan does not create a duplicate', async () => {
  const f = fixture();
  await assert.rejects(() => f.service.createTreatmentProtocolOrder('p1', { ...f.input,
    replacesOrderId: 'old', changeReason: 'No real change', expectedOrderFingerprint: active.orderEditFingerprint(f.old) }), /unchanged/);
  assert.equal(f.writes.length, 0);
});
test('nurse cannot discontinue or replace an existing order', async () => {
  const f = fixture('rn');
  await assert.rejects(() => f.service.createTreatmentProtocolOrder('p1', { ...f.input,
    replacesOrderId: 'old', changeReason: 'Changed care' }), /prescriber/);
  assert.equal(f.writes.length, 0);
});
test('stale, wrong tenant, wrong wound or stopped orders reject replacement atomically', async () => {
  for (const change of [{ description: 'Concurrent edit' }, { orgId: 'other' }, { woundId: 'w2' }, { status: 'discontinued' }]) {
    const f = fixture(); f.setPrevious({ ...f.old, ...change });
    await assert.rejects(() => f.service.createTreatmentProtocolOrder('p1', { ...f.input,
      replacesOrderId: 'old', changeReason: 'Changed care', expectedOrderFingerprint: active.orderEditFingerprint(f.old) }), /Reload and review/);
    assert.equal(f.writes.length, 0);
  }
});
test('new order creation produces an order and audit together without stopping anything', async () => {
  const f = fixture(); await f.service.createTreatmentProtocolOrder('p1', f.input);
  assert.equal(f.writes.length, 2); assert.equal(f.writes.some(w => w.kind === 'update'), false);
});

test('progress note reads prior active orders and excludes discontinued ones', async () => {
  const f = fixture();
  const { WoundProgressNoteService } = load('src/app/services/wound-progress-note.service.ts', {
    '@angular/core': { Injectable: () => x => x }, '../shared/active-orders': active,
    'firebase/firestore': { collection: () => ({}), getDocs: async () => ({ docs:
      [f.old, { ...f.old, id: 'stopped', status: 'discontinued' }].map(r => ({ id: r.id, data: () => r })) }) },
  });
  const notes = Object.create(WoundProgressNoteService.prototype);
  const result = await notes.readOrders('p1', { visitId: 'new', woundId: 'w1' });
  assert.equal(result.length, 1); assert.equal(result[0].note.description, 'Original signed text');
});

test('completion reader accepts prior active order for current assessed wound', async () => {
  const f = fixture();
  const { VisitCompletenessService } = load('src/app/services/visit-completeness.service.ts', {
    '@angular/core': { Injectable: () => x => x }, '../shared/active-orders': active,
    '../shared/clinical-visit-link': links, '../shared/wound-identity': { resolveWoundId: r => r.woundId || r.id },
    '../shared/care-plan': load('src/app/shared/care-plan.ts'),
  });
  const completion = Object.create(VisitCompletenessService.prototype);
  completion.policies = { get: async () => ({ required: ['order'] }) };
  completion.read = async path => path.endsWith('/orders') ? [f.old] :
    path.endsWith('/woundAssessments') ? [{ id: 'assessment', woundId: 'w1', visitId: 'new' }] : [];
  const result = await completion.evaluate('p1', 'follow_up', new Date(), { visitId: 'new' });
  assert.equal(result.items.find(i => i.circle === 'order').complete, true);
});

test('page cannot place an order unless editor is explicitly opened', async () => {
  const { ClinicalOrderPage } = load('src/app/pages/clinical-order/clinical-order.page.ts', {
    '@angular/core': { Component: () => x => x }, '../../shared/active-orders': active,
  });
  const page = Object.create(ClinicalOrderPage.prototype);
  page.editorOpen = false; page.selectedTreatmentTemplate = template; page.selectedWoundType = 'wet';
  page.orderService = { createTreatmentProtocolOrder: () => assert.fail('Unexpected order creation') };
  await page.save();
});
