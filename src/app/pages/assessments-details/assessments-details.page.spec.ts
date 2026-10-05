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
});
