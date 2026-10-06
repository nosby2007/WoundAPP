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
  it('never edits signed RN findings via the provider review screen', () => {
    component.canReview = true; component.assessment = {createdByUid:'rn',locked:true,esign:{signed:true}};
    expect(component.canEditAssessment).toBeFalse();
  });
  it('keeps surveyor/facility read-only views read only', () => {
    component.readOnly = true; component.assessment = {};
    expect(component.canEditAssessment).toBeFalse();
  });
});
