import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { WoundCodingSectionComponent } from './wound-coding-section.component';
import { ClinicalCoding, clinicalCodingOf, emptyClinicalCoding, validateClinicalCoding } from './clinical-coding';

// Synthetic clinicians and wound only.
const rn = { uid: 'rn-1', displayName: 'Synthetic RN', role: 'rn', credentials: 'RN' };

function section(extra: Partial<WoundCodingSectionComponent> = {}): WoundCodingSectionComponent {
  const component = new WoundCodingSectionComponent();
  Object.assign(component, { woundId: 'wound-1', actor: rn, providerAuthor: false, serviceDate: '2026-10-20', ...extra });
  component.ngOnChanges({ coding: {} as any, woundId: {} as any });
  return component;
}

@Component({
  standalone: true,
  imports: [WoundCodingSectionComponent],
  template: '<app-wound-coding-section [coding]="coding" woundId="wound-1" (codingChange)="coding = $event"></app-wound-coding-section>',
})
class CodingHostComponent {
  coding: ClinicalCoding = emptyClinicalCoding();
}

describe('WoundCodingSectionComponent', () => {
  it('keeps the diagnosis input focused while the parent echoes each letter', async () => {
    await TestBed.configureTestingModule({ imports: [CodingHostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(CodingHostComponent);
    fixture.detectChanges();
    const component = fixture.debugElement.query(By.directive(WoundCodingSectionComponent)).componentInstance as WoundCodingSectionComponent;
    component.addDiagnosis();
    fixture.detectChanges();
    await fixture.whenStable();

    const input = fixture.nativeElement.querySelector('ion-input') as HTMLIonInputElement;
    await input.setFocus();
    const nativeInput = await input.getInputElement();
    for (const code of ['L', 'L8', 'L89', 'L89.', 'L89.1', 'L89.15', 'L89.153']) {
      component.onDiagnosisCode(component.model.diagnoses[0], code);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(fixture.nativeElement.querySelector('ion-input')).toBe(input);
      expect(document.activeElement).toBe(nativeInput);
    }
    expect(fixture.componentInstance.coding.diagnoses[0].code).toBe('L89.153');
    fixture.destroy();
  });

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
