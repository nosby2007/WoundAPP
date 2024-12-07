import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ControlInfectionsComponent } from './control-infections.component';

describe('ControlInfectionsComponent', () => {
  let component: ControlInfectionsComponent;
  let fixture: ComponentFixture<ControlInfectionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ControlInfectionsComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ControlInfectionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
