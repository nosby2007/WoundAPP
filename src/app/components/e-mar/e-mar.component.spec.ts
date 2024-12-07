import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EMARComponent } from './e-mar.component';

describe('EMARComponent', () => {
  let component: EMARComponent;
  let fixture: ComponentFixture<EMARComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ EMARComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EMARComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
