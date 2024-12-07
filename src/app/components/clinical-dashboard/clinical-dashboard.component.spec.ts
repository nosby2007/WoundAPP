import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClinicalDashboardComponent } from './clinical-dashboard.component';

describe('ClinicalDashboardComponent', () => {
  let component: ClinicalDashboardComponent;
  let fixture: ComponentFixture<ClinicalDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ClinicalDashboardComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClinicalDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
