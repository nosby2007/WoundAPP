import { ComponentFixture, TestBed } from '@angular/core/testing';
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
});
