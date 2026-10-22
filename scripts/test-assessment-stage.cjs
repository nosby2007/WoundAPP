'use strict';
// Lightweight isolated method tests; not a replacement for Angular rendering/build.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, imports = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const result = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, experimentalDecorators: true,
  }, reportDiagnostics: true });
  assert.equal(result.diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
  const module = { exports: {} };
  vm.runInNewContext(result.outputText, { module, exports: module.exports,
    require: name => imports[name] || {}, console, setTimeout, clearTimeout });
  return module.exports;
}
const stages = load('src/app/shared/wound-stage.ts');
const { AssessmentFormPage } = load('src/app/pages/assessment-form/assessment-form.page.ts', {
  '@angular/core': { Component: () => target => target },
  '../../shared/wound-stage': stages,
  'firebase/auth': { getAuth: () => ({ currentUser: { uid: 'synthetic-user', displayName: 'Test' } }) },
  'src/app/shared/wound-treatment': { buildWoundTreatment: () => null },
  '../../shared/assessment-debridement': { assessmentDebridementPayload: () => null },
  'src/app/shared/wound-identity': { woundIdForCreate: (wound, id) => wound || id },
  'src/app/shared/clinical-visit-link': { clinicalVisitQueryParams: value => value },
});
function page(type = 'Pressure', stage = 'Stage 3') {
  const p = Object.create(AssessmentFormPage.prototype);
  const raw = { describe: { type, stage, location: 'SYNTHETIC' }, measurements: {}, woundBed: {},
    periwound: {}, exudate: {}, pain: {}, progress: {}, treatment: {}, orders: {} };
  const control = key => ({ get value() { return raw.describe[key]; },
    setValue(value, options) { raw.describe[key] = value; if (options?.emitEvent !== false) p.formRevision++; },
    markAsDirty() {},
  });
  p.form = { invalid: false, get value() { return raw; },
    controls: { describe: { controls: { type: control('type'), stage: control('stage') } } },
    getRawValue: () => JSON.parse(JSON.stringify(raw)),
    patchValue: value => { if (value.describe) Object.assign(raw.describe, value.describe); },
  };
  Object.assign(p, { patientId: 'synthetic-patient', woundId: null, assessmentId: null,
    fieldEncounterVisitId: 'visit', appointmentId: 'visit', formRevision: 0,
    loading: false, restoringDraft: false, assessmentSaved: false,
    pendingDraftSave: Promise.resolve(), scheduleDraft() {},
    drafts: { load: async () => null, save: async () => {}, clear: async () => {} },
  });
  return p;
}
test('stage is blank for every non-pressure vocabulary type', () => {
  for (const type of ['Skin Tear','Diabetic','Venous','Arterial','Surgical','MASD','Rash','Blister',
    'Laceration','Open Lesion','Hematoma','Burn','Abscess','Other','',null]) {
    assert.equal(stages.stageForWoundType(type, 'Stage 4'), '');
  }
  assert.equal(stages.stageForWoundType('Pressure', 'Stage 4'), 'Stage 4');
  assert.equal(stages.stageForWoundType('Pressure', 'Unstageable'), 'Unstageable');
});
test('explicit null/blank does not resurrect a legacy stage', () => {
  for (const stage of ['', null]) assert.equal(stages.assessmentStageFromRecord({
    describe: { type: 'Pressure', stage }, stage: 'Stage 3',
  }), '');
  assert.equal(stages.assessmentStageFromRecord({ describe: { type: 'Pressure' }, stage: 'Stage 2' }), 'Stage 2');
});
test('clear persists an explicit blank; changing type never restores the stage', async () => {
  const p = page(); let saved;
  p.drafts.save = async (_, payload) => { saved = payload; };
  p.clearStage(); await p.persistDraft();
  assert.equal(saved.form.describe.stage, '');
  p.form.patchValue({ describe: { type: 'Venous', stage: 'Stage 4' } }); p.normalizeStage();
  p.form.patchValue({ describe: { type: 'Pressure' } }); p.normalizeStage();
  assert.equal(p.form.getRawValue().describe.stage, '');
});
test('restored non-pressure drafts lose the inappropriate stage only in the editable form', async () => {
  const p = page(); const draft = { payload: { form: { describe: { type: 'Surgical', stage: 'Stage 3' } } } };
  p.drafts.load = async () => draft;
  await p.restoreDraft();
  assert.equal(p.form.getRawValue().describe.stage, '');
  assert.equal(draft.payload.form.describe.stage, 'Stage 3');
});
test('a late restore cannot undo a clinician clear', async () => {
  const p = page(); let resolve;
  p.drafts.load = () => new Promise(r => { resolve = r; });
  const pending = p.restoreDraft(); p.clearStage();
  resolve({ payload: { form: { describe: { type: 'Pressure', stage: 'Stage 3' } } } });
  await pending; assert.equal(p.form.getRawValue().describe.stage, '');
});
test('draft saves are serialized, including a later blank', async () => {
  const p = page(); const writes = []; let release;
  p.drafts.save = async (_, payload) => {
    writes.push(payload.form.describe.stage);
    if (writes.length === 1) await new Promise(r => { release = r; });
  };
  const first = p.persistDraft(); await Promise.resolve(); await Promise.resolve();
  p.clearStage(); const second = p.persistDraft();
  assert.deepEqual(writes, ['Stage 3']);
  release(); await Promise.all([first, second]);
  assert.deepEqual(writes, ['Stage 3', '']);
});
test('saving a new wound clears its original draft and destruction does not recreate it', async () => {
  const p = page('Venous', 'Stage 4'); const cleared = []; let payload; let draftWrites = 0;
  p.toastCtrl = { create: async () => ({ present: async () => {}, dismiss: async () => {} }) };
  p.assessments = { newId: () => 'new-wound', createWithId: async (_, id, data) => {
    payload = data; return { woundId: id, fieldEncounterVisitId: 'resolved-visit' };
  } };
  p.router = { navigate: async () => true };
  p.drafts.clear = async key => { cleared.push(key.contextKey); };
  p.drafts.save = async () => { draftWrites++; };
  await p.save(); p.ngOnDestroy(); await p.pendingDraftSave;
  assert.equal(payload.describe.stage, null);
  assert.deepEqual(cleared, ['new:visit']);
  assert.equal(draftWrites, 0);
});
