import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VisitMedicalComponent } from './visit-medical.component';

describe('VisitMedicalComponent', () => {
  let component: VisitMedicalComponent;
  let fixture: ComponentFixture<VisitMedicalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ VisitMedicalComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VisitMedicalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
