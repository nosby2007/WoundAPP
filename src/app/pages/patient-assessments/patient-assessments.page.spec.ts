import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PatientAssessmentsPage } from './patient-assessments.page';

describe('PatientAssessmentsPage', () => {
  let component: PatientAssessmentsPage;
  let fixture: ComponentFixture<PatientAssessmentsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(PatientAssessmentsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
