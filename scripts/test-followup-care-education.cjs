'use strict';
// Synthetic isolated tests: no Firebase or patient-data writes.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, imports = {}) {
  const js = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, experimentalDecorators: true },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, { module, exports: module.exports, require: n => imports[n] || {}, Date, console, setTimeout, clearTimeout });
  return module.exports;
}
const plans = load('src/app/shared/care-plan.ts');
const education = load('src/app/shared/education.ts');
const links = load('src/app/shared/clinical-visit-link.ts');
function fixture() {
  let role = 'np'; let rows = [];
  let plan = { orgId: 'org', patientId: 'p', woundId: 'w', title: 'Original', description: null, startDate: '2020-01-01', visitId: 'old' };
  let problem = { orgId: 'org', patientId: 'p', status: 'active', category: 'nutrition', goalCatalogRefs: [], customGoals: ['Original goal'] };
  const writes = [], audits = [];
  const sdk = {
    collection: (_, p) => ({ path: p }), doc: (base, p) => ({ path: p || `${base.path}/new`, id: p?.split('/').pop() || 'new' }),
    getDoc: async () => ({ data: () => plan }),
    getDocs: async ref => ({ size: ref.path.endsWith('/problems') ? 1 : rows.length,
      docs: ref.path.endsWith('/problems') ? [{ id: 'problem', data: () => problem }] : rows.map((r, i) => ({ id: r.id || String(i), data: () => r })) }),
    serverTimestamp: () => 'server-time', Timestamp: { now: () => 'now' },
    runTransaction: async (_, cb) => {
      const pending = [];
      await cb({ get: async ref => ({ data: () => ref.path.includes('/problems/') ? problem : plan }),
        update: (ref, data) => pending.push({ type: 'update', ref, data }), set: (ref, data) => pending.push({ type: 'set', ref, data }) });
      writes.push(...pending);
    },
    writeBatch: () => { const pending = []; return { set: (ref, data) => pending.push({ type: 'set', ref, data }), commit: async () => writes.push(...pending) }; },
  };
  const imports = { '@angular/core': { Injectable: () => x => x }, 'firebase/firestore': sdk,
    '../firebase': { auth: { currentUser: { uid: 'actor', displayName: 'Synthetic' } }, db: {} },
    '../shared/care-plan': plans, '../shared/education': education, '../shared/clinical-visit-link': links };
  const { CarePlanService } = load('src/app/services/care-plan.service.ts', imports);
  const { EducationService } = load('src/app/services/education.service.ts', imports);
  const cp = Object.create(CarePlanService.prototype), ed = Object.create(EducationService.prototype);
  for (const s of [cp, ed]) { s.tenant = { currentOrgId: async () => 'org' }; s.audit = { record: async e => audits.push(e) }; }
  cp.clinicalIdentity = { requireCurrentIdentity: async () => ({ uid: 'actor', role }) };
  const draft = { title: 'Original', description: null, startDate: '2020-01-01', woundId: 'w', category: 'nutrition', goalCatalogRefs: [], customGoals: ['Original goal'] };
  const edit = { id: 'plan', problemId: 'problem', fingerprint: plans.carePlanEditFingerprint(plan, problem), draft };
  return { cp, ed, writes, audits, draft, edit, plan, setPlan: p => plan = p, setRole: r => role = r, setRows: r => rows = r };
}
test('signed ongoing care plan is active; archived, closed and ended plans are not', () => {
  assert.equal(plans.isActiveCarePlan({ esign: { signed: true }, locked: true }), true);
  for (const row of [{ archivedAt: 'date' }, { status: 'completed' }, { endDate: '2020-01-01' }, { startDate: '2099-01-01' }]) assert.equal(plans.isActiveCarePlan(row), false);
});
test('care-plan list keeps prior encounter plans and excludes other wounds/tenants', async () => {
  const f = fixture(); f.setRows([f.plan, { ...f.plan, woundId: 'other' }, { ...f.plan, orgId: 'other' }]);
  assert.equal((await f.cp.listActive('p', 'w')).length, 1);
});
test('continue care plan records audit only, no duplicate plan', async () => {
  const f = fixture(); f.setRows([{ ...f.plan, id: 'plan' }]);
  await f.cp.continuePlan('p', 'plan', { woundId: 'w', visitId: 'new' });
  assert.equal(f.writes.length, 0); assert.equal(f.audits[0].action, 'care_plan_reviewed_unchanged');
});
test('modified unsigned plan updates same plan/problem plus audit, not encounter or author', async () => {
  const f = fixture(); await f.cp.updateExisting('p', f.edit, { ...f.draft, customGoals: ['Changed goal'] }, 'Documented change');
  assert.equal(f.writes.length, 3); assert.equal(f.writes.filter(w => w.type === 'set').length, 1);
  const patch = f.writes[0].data;
  for (const key of ['visitId','woundId','createdBy','authorIdentity','esign','locked']) assert.equal(key in patch, false);
});
test('signed/locked and stale care plans cannot be edited', async () => {
  for (const change of [{ locked: true }, { esign: { signed: true } }, { title: 'Concurrent change' }, { orgId: 'other' }, { woundId: 'other' }]) {
    const f = fixture(); f.setPlan({ ...f.plan, ...change });
    await assert.rejects(() => f.cp.updateExisting('p', f.edit, { ...f.draft, title: 'Changed' }, 'Documented change'));
    assert.equal(f.writes.length, 0);
  }
});
test('unchanged plan and nurse edit do not write', async () => {
  const f = fixture();
  await assert.rejects(() => f.cp.updateExisting('p', f.edit, f.draft, 'No actual change'), /No care-plan change/);
  f.setRole('rn');
  await assert.rejects(() => f.cp.updateExisting('p', f.edit, { ...f.draft, title: 'Changed' }, 'Care changed'), /prescriber/);
  assert.equal(f.writes.length, 0);
});
test('care plan creation saves parent/problem/audit atomically', async () => {
  const f = fixture(); await f.cp.create('p', f.draft, { visitId: 'new' });
  assert.equal(f.writes.length, 3);
});
test('education history filters by wound before limiting; different tenant excluded', async () => {
  const f = fixture();
  f.setRows([{ orgId: 'org', topic: 'Other', woundId: 'other' }, { orgId: 'other', topic: 'Wrong tenant', woundId: 'w' },
    { orgId: 'org', topic: 'Prior', woundId: 'w' }]);
  const rows = await f.ed.list('p', 1, { woundId: 'w' });
  assert.equal(rows.length, 1); assert.equal(rows[0].topic, 'Prior');
});
test('education review never writes a teaching record or claims teaching occurred', async () => {
  const f = fixture(); f.setRows([{ orgId: 'org', topic: 'Prior', woundId: 'w' }]);
  await f.ed.reviewHistory('p', { woundId: 'w' });
  assert.equal(f.writes.length, 0); assert.equal(f.audits[0].metadata.newTeachingRecorded, false);
});
test('reusing education copies topic only, not prior delivery, patient response or notes', () => {
  const { EducationPage } = load('src/app/pages/education/education.page.ts', {
    '@angular/core': { Component: () => x => x }, '../../shared/education': education,
  });
  const page = Object.create(EducationPage.prototype);
  Object.assign(page, { topics: [], loading: false, saving: false, learners: ['patient'], readiness: 'eager', method: ['handout'], response: ['verbalizes_understanding'], notes: 'Old' });
  page.beginSession({ id: 'prior', topic: 'Existing subject' });
  assert.equal(page.customTopic, 'Existing subject'); assert.equal(page.previousEducationId, 'prior');
  assert.equal(page.learners.length, 0); assert.equal(page.method.length, 0); assert.equal(page.response.length, 0);
  assert.equal(page.readiness, null); assert.equal(page.notes, ''); assert.equal(page.canSave, false);
});
test('new refusal session does not retain hidden delivery/understanding values', async () => {
  const f = fixture(); await f.ed.create('p', { topic: 'Subject', learners: ['patient'], readiness: 'refuses',
    method: ['handout'], response: ['verbalizes_understanding'], woundId: 'w', notes: null, category: null });
  assert.equal(f.writes.length, 2); assert.equal(f.writes[0].data.method.length, 0); assert.equal(f.writes[0].data.response.length, 0);
});
test('no education record can be created without a topic and actual learner', async () => {
  const f = fixture(); await assert.rejects(() => f.ed.create('p', { topic: 'Subject', learners: [] }), /actual session/);
  assert.equal(f.writes.length, 0);
});
