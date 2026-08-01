import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AssessmentFormPage } from './assessment-form.page';

describe('AssessmentFormPage', () => {
  let component: AssessmentFormPage;
  let fixture: ComponentFixture<AssessmentFormPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AssessmentFormPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
