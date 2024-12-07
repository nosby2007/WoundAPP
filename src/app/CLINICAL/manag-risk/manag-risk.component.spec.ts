import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManagRiskComponent } from './manag-risk.component';

describe('ManagRiskComponent', () => {
  let component: ManagRiskComponent;
  let fixture: ComponentFixture<ManagRiskComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ManagRiskComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ManagRiskComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
