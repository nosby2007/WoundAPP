import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pageTestProviders } from '../../../testing/page-test-providers';
import { EducationPage } from './education.page';

describe('EducationPage', () => {
  let component: EducationPage;
  let fixture: ComponentFixture<EducationPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: pageTestProviders({ patientId: 'p1' }) });
    fixture = TestBed.createComponent(EducationPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('will not save a topic with nobody taught', () => {
    component.customTopic = 'Pressure relief';
    expect(component.canSave).toBe(false);

    component.learners = ['patient'];
    expect(component.canSave).toBe(true);
  });

  it('stops asking how it was delivered once the patient has refused', () => {
    component.customTopic = 'Pressure relief';
    component.learners = ['patient'];
    component.readiness = 'refuses';
    expect(component.refused).toBe(true);
    expect(component.gaps).toEqual([]);
  });
});
