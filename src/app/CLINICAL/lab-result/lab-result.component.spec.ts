import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LabResultComponent } from './lab-result.component';

describe('LabResultComponent', () => {
  let component: LabResultComponent;
  let fixture: ComponentFixture<LabResultComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ LabResultComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LabResultComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
