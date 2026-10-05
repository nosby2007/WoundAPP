import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { pageTestProviders } from '../../../testing/page-test-providers';
import { PatientAssessmentsPage } from './patient-assessments.page';

describe('PatientAssessmentsPage', () => {
  let component: PatientAssessmentsPage;
  let fixture: ComponentFixture<PatientAssessmentsPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: pageTestProviders({ patientId: 'p1' }) });
    fixture = TestBed.createComponent(PatientAssessmentsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('opens the wound-specific care plan with wound and episode linkage', () => {
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    component.assessments.set([{
      id: 'assessment-1',
      woundId: 'wound-1',
      episodeId: 'episode-1',
      assessedAt: new Date('2026-09-27T12:00:00Z'),
    }]);

    component.openCarePlan();

    expect(navigate).toHaveBeenCalledWith(
      ['/tabs', 'skin-wound', 'p1', 'assessments', 'assessment-1', 'care-plan'],
      { queryParams: { woundId: 'wound-1', episodeId: 'episode-1' } },
    );
  });

  it('does not choose an arbitrary wound when the patient has several', () => {
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    component.assessments.set([
      { id: 'assessment-1', woundId: 'wound-1' },
      { id: 'assessment-2', woundId: 'wound-2' },
    ]);

    component.openCarePlan();

    expect(navigate).not.toHaveBeenCalled();
    expect(component.evvMessage()).toContain('Choose the wound');
  });
});
