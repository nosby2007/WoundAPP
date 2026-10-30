import { WoundCodingSectionComponent } from './wound-coding-section.component';
import { ClinicalCoding, clinicalCodingOf, validateClinicalCoding } from './clinical-coding';
import { BILLING_CAPABILITIES } from './billing-capabilities';

// Synthetic clinicians and wound only.
const rn = { uid: 'rn-1', displayName: 'Synthetic RN', role: 'rn', credentials: 'RN' };

/**
 * Procedure (CPT/HCPCS) tests exercise the future licensed module; production
 * is clinical-only (see the 'clinical-only production mode' suite below).
 */
function section(extra: Partial<WoundCodingSectionComponent> = {}, licensed = true): WoundCodingSectionComponent {
  const component = new WoundCodingSectionComponent();
  Object.assign(component, { woundId: 'wound-1', actor: rn, providerAuthor: false, serviceDate: '2026-10-20', ...extra });
  if (licensed) (component as any).procedureCodingEnabled = true;
  component.ngOnChanges({ coding: {} as any, woundId: {} as any });
  return component;
}

describe('WoundCodingSectionComponent', () => {
  it('records an RN diagnosis as a proposal on this wound', () => {
    const component = section();
    let emitted: ClinicalCoding | null = null;
    component.codingChange.subscribe((value) => emitted = value);
    component.addDiagnosis();
    component.onDiagnosisCode(component.model.diagnoses[0], ' l89.153 ');
    expect(emitted!.diagnoses[0]).toEqual(jasmine.objectContaining({ code: 'L89.153', woundId: 'wound-1', status: 'proposed', codeSource: 'manual' }));
    expect(component.blockingIssues()).toEqual([]);
  });

  it('accepts a CPT entered by number without a catalog, flagged unverified', () => {
    const component = section({ debridementDocumented: true, debridementAreaCm2: 12 });
    component.addProcedure();
    component.onProcedureCode(component.model.procedures[0], '97597');
    expect(component.blockingIssues()).toEqual([]);
    expect(component.model.procedures[0].debridementProcedureId).toBe('assessment');
    expect(component.issues.some((issue) => issue.level === 'warning')).toBeTrue();
    expect(component.suggestedUnits(component.model.procedures[0])).toEqual({ units: 1, area: 12 });
  });

  it('refuses a debridement code when this assessment documents no debridement', () => {
    const component = section({ debridementDocumented: false });
    component.addProcedure();
    component.onProcedureCode(component.model.procedures[0], '11042');
    expect(component.blockingIssues().some((message) => /documented debridement/.test(message))).toBeTrue();
  });

  it('keeps E/M off the wound: the provider records it in the visit note', () => {
    const component = section();
    component.addProcedure();
    component.onProcedureCode(component.model.procedures[0], '99342');
    expect(component.blockingIssues().some((message) => /visit note/.test(message))).toBeTrue();
  });

  it('rejects malformed codes and duplicates', () => {
    const component = section();
    component.addDiagnosis();
    component.onDiagnosisCode(component.model.diagnoses[0], 'L89.153');
    component.addDiagnosis();
    component.onDiagnosisCode(component.model.diagnoses[1], 'L89.153');
    component.addProcedure();
    component.onProcedureCode(component.model.procedures[0], '123');
    const errors = component.blockingIssues();
    expect(errors.some((message) => /already recorded/.test(message))).toBeTrue();
    expect(errors.some((message) => /not a CPT/.test(message))).toBeTrue();
  });
});

describe('clinical-only production mode (no AMA CPT license)', () => {
  it('ships with CPT disabled and no runtime toggle', () => {
    expect(BILLING_CAPABILITIES.amaCptLicensed).toBeFalse();
    expect(Object.isFrozen(BILLING_CAPABILITIES)).toBeTrue();
    expect(new WoundCodingSectionComponent().procedureCodingEnabled).toBeFalse();
  });

  it('offers diagnoses only: no procedure row, no CPT unit suggestion', () => {
    const component = section({ debridementDocumented: true, debridementAreaCm2: 45 }, false);
    component.addProcedure();
    expect(component.model.procedures).toEqual([]);
    expect(component.suggestedUnits({ code: '11045' } as any)).toBeNull();
    component.addDiagnosis();
    expect(component.model.diagnoses.length).toBe(1);
  });

  it('keeps historical procedure rows untouched and never blocks saving on them', () => {
    const component = new WoundCodingSectionComponent();
    Object.assign(component, { woundId: 'wound-1', actor: rn, coding: { schemaVersion: 1, visitId: null, diagnoses: [],
      procedures: [{ id: 'px-old', codeSystem: 'CPT', code: '123', units: 0, scope: 'wound', woundId: 'wound-1', diagnosisIds: [], status: 'proposed' }] } });
    component.ngOnChanges({ coding: {} as any });
    let emitted: ClinicalCoding | null = null;
    component.codingChange.subscribe((value) => emitted = value);
    expect(component.blockingIssues()).toEqual([]);
    component.addDiagnosis();
    expect(emitted!.procedures.map((row) => row.id)).toEqual(['px-old']);
  });
});

describe('WoundAPP -> JADE coded assessment record', () => {
  it('writes the shared schema JADE reads back unchanged', () => {
    const component = section({ debridementDocumented: true, debridementAreaCm2: 30 });
    let emitted: ClinicalCoding | null = null;
    component.codingChange.subscribe((value) => emitted = value);
    component.addDiagnosis();
    component.onDiagnosisCode(component.model.diagnoses[0], 'L89.153');
    component.addProcedure();
    component.onProcedureCode(component.model.procedures[0], '97597');
    // The stored assessment after WoundAPP Review & Sign.
    const stored = { woundId: 'wound-1', visitId: 'visit-1', locked: true, esign: { signed: true, signerUid: 'rn-1' }, clinicalCoding: emitted };
    const read = clinicalCodingOf(stored)!;
    expect(read.diagnoses[0].code).toBe('L89.153');
    expect(read.procedures[0]).toEqual(jasmine.objectContaining({ code: '97597', scope: 'wound', woundId: 'wound-1', debridementProcedureId: 'assessment', codeSource: 'manual' }));
    expect(validateClinicalCoding(read, { woundIds: ['wound-1'], debridementProcedureIds: ['assessment'] }).filter((issue) => issue.level === 'error')).toEqual([]);
  });
});
