import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UDAComponent } from './uda.component';

describe('UDAComponent', () => {
  let component: UDAComponent;
  let fixture: ComponentFixture<UDAComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ UDAComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UDAComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
