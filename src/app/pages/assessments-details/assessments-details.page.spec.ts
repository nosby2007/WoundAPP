import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pageTestProviders } from '../../../testing/page-test-providers';
import { AssessmentDetailPage } from './assessments-details.page';

describe('AssessmentDetailPage', () => {
  let component: AssessmentDetailPage;
  let fixture: ComponentFixture<AssessmentDetailPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: pageTestProviders({ patientId: 'p1', assessmentId: 'a1' }) });
    fixture = TestBed.createComponent(AssessmentDetailPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
  it('lets a provider edit their own unsigned draft, not another author draft', () => {
    component.canReview = true;component.actorUid='np';component.assessment={createdByUid:'np'};
    expect(component.canEditAssessment).toBeTrue();
    component.assessment.createdByUid='rn';expect(component.canEditAssessment).toBeFalse();
  });
  it('requires both signature and lock before review', () => {
    component.canReview=true;component.assessment={locked:true};
    expect(component.canRecordReview).toBeFalse();
    component.assessment.esign={signed:true};expect(component.canRecordReview).toBeTrue();
  });
  it('shows an existing provider review to an authorized read-only reader without write controls', () => {
    component.loading=false;component.canReview=false;component.readOnly=true;
    component.assessment={providerReview:{reviewed:true,reviewedByName:'Example NP',decision:'Concur',providerNote:'Reviewed existing wound findings'}};
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Reviewed existing wound findings');
    expect(fixture.nativeElement.textContent).not.toContain('Save provider review');
  });
  it('never edits signed RN findings via the provider review screen', () => {
    component.canReview = true; component.assessment = {createdByUid:'rn',locked:true,esign:{signed:true}};
    expect(component.canEditAssessment).toBeFalse();
  });
  it('keeps surveyor/facility read-only views read only', () => {
    component.readOnly = true; component.assessment = {};
    expect(component.canEditAssessment).toBeFalse();
  });
});
