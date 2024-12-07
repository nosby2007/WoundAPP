import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PatientClinicalComponent } from './patient-clinical.component';

describe('PatientClinicalComponent', () => {
  let component: PatientClinicalComponent;
  let fixture: ComponentFixture<PatientClinicalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PatientClinicalComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PatientClinicalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
