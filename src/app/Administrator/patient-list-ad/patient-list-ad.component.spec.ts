import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PatientListAdComponent } from './patient-list-ad.component';

describe('PatientListAdComponent', () => {
  let component: PatientListAdComponent;
  let fixture: ComponentFixture<PatientListAdComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PatientListAdComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PatientListAdComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
