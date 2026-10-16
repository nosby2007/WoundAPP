import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pageTestProviders } from '../../../testing/page-test-providers';
import { AssessmentFormPage } from './assessment-form.page';
import { of } from 'rxjs';
import { AssessmentsService } from '../../services/assessments.service';
import { assessmentDebridementPayload } from '../../shared/assessment-debridement';

describe('AssessmentFormPage', () => {
  let component: AssessmentFormPage;
  let fixture: ComponentFixture<AssessmentFormPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: pageTestProviders({ patientId: 'p1' }) });
    fixture = TestBed.createComponent(AssessmentFormPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('reveals procedure inputs only when performed is explicitly checked', () => {
    const procedure = component.form.controls.debridementProcedure;
    const instrument = () => fixture.nativeElement.querySelector('[formControlName="instrument"]');
    expect(instrument()).toBeNull();
    procedure.controls.performed.setValue(true);
    fixture.detectChanges();
    expect(instrument()).not.toBeNull();
    procedure.patchValue({ instrument: 'Curette', areaDebridedCm2: -1 });
    procedure.controls.performed.setValue(false);
    fixture.detectChanges();
    expect(instrument()).toBeNull();
    expect(procedure.valid).toBeTrue();
    expect(assessmentDebridementPayload(procedure.getRawValue())).toEqual({ performed: false });
  });

  it('loads recorded procedure fields when editing the same assessment', () => {
    const procedure = { performed: true, instrument: 'Curette', tissueLevel: 'Slough only',
      areaDebridedCm2: 1.56, postMeasurements: { depth: 0.4 } };
    spyOn(TestBed.inject(AssessmentsService), 'getRaw').and.returnValue(of({
      woundId: 'w1', measurements: { depth: 1.5 }, debridementProcedure: procedure,
    }));
    component.assessmentId = 'a1';
    component.ngOnInit();
    const loaded = component.form.controls.debridementProcedure.getRawValue();
    expect(loaded.instrument).toBe('Curette');
    expect(loaded.postMeasurements.depth).toBe(0.4);
    expect(loaded.areaDebridedCm2).toBe(1.56);
    expect(component.form.controls.measurements.controls.depth.value).toBe(1.5);
  });

  it('does not carry a prior procedure into a new re-evaluation', async () => {
    spyOn(TestBed.inject(AssessmentsService), 'getLatestRawForWound').and.resolveTo({
      id: 'previous', measurements: { depth: 1.5 },
      debridementProcedure: { performed: true, instrument: 'Scalpel', areaDebridedCm2: 3 },
    });
    component.woundId = 'w1';
    await (component as any).loadReevaluationBaseline();
    expect(component.form.controls.measurements.controls.depth.value).toBe(1.5);
    expect(assessmentDebridementPayload(component.form.controls.debridementProcedure.getRawValue())).toBeNull();
  });
});
