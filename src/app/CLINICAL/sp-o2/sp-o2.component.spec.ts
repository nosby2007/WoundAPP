import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SpO2Component } from './sp-o2.component';

describe('SpO2Component', () => {
  let component: SpO2Component;
  let fixture: ComponentFixture<SpO2Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SpO2Component ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SpO2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
