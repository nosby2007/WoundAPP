import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pageTestProviders } from '../../../testing/page-test-providers';
import { AssessmentFormPage } from './assessment-form.page';
import { of } from 'rxjs';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular/standalone';
import { getAuth } from 'firebase/auth';
import { AssessmentsService } from '../../services/assessments.service';
import { assessmentDebridementPayload } from '../../shared/assessment-debridement';
import { ClinicalDraftService } from '../../services/clinical-draft.service';
import { positionForZone } from '../../shared/wound-anatomy';

describe('AssessmentFormPage', () => {
  let component: AssessmentFormPage;
  let fixture: ComponentFixture<AssessmentFormPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      ...pageTestProviders({ patientId: 'p1' }),
      { provide: AssessmentsService, useValue: {
        getPatient: jasmine.createSpy('getPatient').and.returnValue(of({ name: 'Patient', gender: 'female' })),
        getRaw: jasmine.createSpy('getRaw').and.returnValue(of(null)),
        getLatestRawForWound: jasmine.createSpy('getLatestRawForWound').and.resolveTo(null),
      } },
      { provide: ClinicalDraftService, useValue: {
        load: jasmine.createSpy('load').and.resolveTo(null),
        save: jasmine.createSpy('save').and.resolveTo(undefined),
        clear: jasmine.createSpy('clear').and.resolveTo(undefined),
      } },
    ] });
    fixture = TestBed.createComponent(AssessmentFormPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.patientProfile).toBe('female');
  });

  it('lets the clinician clear a pressure stage and keeps it blank in the draft', async () => {
    await fixture.whenStable();
    component.form.controls.describe.patchValue({ type: 'Pressure', stage: 'Stage 3' });
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[aria-label="Clear wound stage"]').click();
    await (component as any).persistDraft();
    expect(component.form.controls.describe.controls.stage.value).toBe('');
    expect(TestBed.inject(ClinicalDraftService).save).toHaveBeenCalledWith(
      jasmine.any(Object), jasmine.objectContaining({ form: jasmine.objectContaining({
        describe: jasmine.objectContaining({ stage: '' }),
      }) }),
    );
  });

  it('removes a pressure stage when the clinician changes wound type', () => {
    component.form.controls.describe.patchValue({ type: 'Pressure', stage: 'Stage 4' });
    component.form.controls.describe.controls.type.setValue('Venous');
    fixture.detectChanges();
    expect(component.form.controls.describe.controls.stage.value).toBe('');
    expect(fixture.nativeElement.querySelector('[formControlName="stage"]')).toBeNull();
    component.form.controls.describe.controls.type.setValue('Pressure');
    expect(component.form.controls.describe.controls.stage.value).toBe('');
  });

  it('does not restore an inappropriate stage from a non-pressure draft', async () => {
    await fixture.whenStable();
    (TestBed.inject(ClinicalDraftService).load as jasmine.Spy).and.resolveTo({
      payload: { form: { describe: { type: 'Surgical', stage: 'Stage 3' } } },
    });
    await (component as any).restoreDraft();
    expect(component.form.controls.describe.controls.stage.value).toBe('');
  });

  it('does not let a slow draft response undo a clear action', async () => {
    await fixture.whenStable();
    let resolveDraft!: (value: any) => void;
    (TestBed.inject(ClinicalDraftService).load as jasmine.Spy).and.returnValue(
      new Promise(resolve => { resolveDraft = resolve; }),
    );
    component.form.controls.describe.controls.stage.setValue('Stage 3');
    const restoring = (component as any).restoreDraft();
    component.clearStage();
    resolveDraft({ payload: { form: { describe: { type: 'Pressure', stage: 'Stage 3' } } } });
    await restoring;
    expect(component.form.controls.describe.controls.stage.value).toBe('');
  });

  describe('after the assessment has committed', () => {
    const toastMessages = () => (TestBed.inject(ToastController).create as jasmine.Spy).calls.allArgs().map(([o]) => o.message);

    beforeEach(async () => {
      await fixture.whenStable();
      Object.defineProperty(getAuth(), 'currentUser', { configurable: true, value: { uid: 'u1', displayName: 'Nurse' } });
      spyOn(TestBed.inject(ToastController), 'create').and.resolveTo({
        present: () => Promise.resolve(),
        dismiss: () => Promise.resolve(true),
      } as any);
      const assessments = TestBed.inject(AssessmentsService) as any;
      assessments.newId = jasmine.createSpy('newId').and.returnValue('a1');
      assessments.createWithId = jasmine.createSpy('createWithId').and.resolveTo({ woundId: 'a1', episodeId: 'e1', appointmentId: null, fieldEncounterVisitId: null });
      assessments.update = jasmine.createSpy('update').and.resolveTo(undefined);
      assessments.uploadWoundPhoto = jasmine.createSpy('uploadWoundPhoto').and.resolveTo('https://photo');
      Object.defineProperty(component.form, 'invalid', { configurable: true, get: () => false });
    });

    afterEach(() => {
      delete (getAuth() as any).currentUser;
    });

    it('reports a failed photo upload as a saved assessment and keeps going', async () => {
      (component as any).photoDataUrl = 'data:image/jpeg;base64,AA==';
      (TestBed.inject(AssessmentsService).uploadWoundPhoto as jasmine.Spy).and.rejectWith({ code: 'storage/unknown' });
      const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

      await component.save();

      expect(toastMessages().some((m) => m.startsWith('Assessment saved') && m.includes('photo did not upload'))).toBeTrue();
      expect(toastMessages().some((m) => m.includes('Could not confirm'))).toBeFalse();
      expect(navigate).toHaveBeenCalled();
    });

    it('does not report failure or re-arm Save when the next screen fails to open', async () => {
      spyOn(TestBed.inject(Router), 'navigate').and.rejectWith(new Error('chunk failed'));

      await component.save();
      await component.save();

      expect(toastMessages().some((m) => m.startsWith('Assessment saved, but the next screen'))).toBeTrue();
      expect(toastMessages().some((m) => m.includes('Could not confirm'))).toBeFalse();
      expect(TestBed.inject(AssessmentsService).createWithId).toHaveBeenCalledTimes(1);
    });

    it('still reports failure when the assessment itself was not written', async () => {
      (TestBed.inject(AssessmentsService).createWithId as jasmine.Spy).and.rejectWith(new Error('boom'));

      await component.save();

      expect(toastMessages().some((m) => m.includes('Could not confirm'))).toBeTrue();
      expect((component as any).assessmentSaved).toBeFalse();
    });
  });

  it('does not recreate a completed assessment draft when leaving the form', async () => {
    await fixture.whenStable();
    (component as any).assessmentSaved = true;
    component.ngOnDestroy();
    await (component as any).pendingDraftSave;
    expect(TestBed.inject(ClinicalDraftService).save).not.toHaveBeenCalled();
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
    (TestBed.inject(AssessmentsService).getRaw as jasmine.Spy).and.returnValue(of({
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
    (TestBed.inject(AssessmentsService).getLatestRawForWound as jasmine.Spy).and.resolveTo({
      id: 'previous', measurements: { depth: 1.5 },
      debridementProcedure: { performed: true, instrument: 'Scalpel', areaDebridedCm2: 3 },
    });
    component.woundId = 'w1';
    await (component as any).loadReevaluationBaseline();
    expect(component.form.controls.measurements.controls.depth.value).toBe(1.5);
    expect(assessmentDebridementPayload(component.form.controls.debridementProcedure.getRawValue())).toBeNull();
  });

  it('stores the structured anatomical marker and its confirmed text label together', () => {
    const position = positionForZone('back-right-heel', 'male')!;
    component.onAnatomyChange(position);
    expect(component.form.controls.describe.controls.anatomy.value).toEqual(position);
    expect(component.form.controls.describe.controls.location.value).toBe('Right posterior heel');
  });
});
