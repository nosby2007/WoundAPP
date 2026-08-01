import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AssessmentsDetailsPage } from './assessments-details.page';

describe('AssessmentsDetailsPage', () => {
  let component: AssessmentsDetailsPage;
  let fixture: ComponentFixture<AssessmentsDetailsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AssessmentsDetailsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
