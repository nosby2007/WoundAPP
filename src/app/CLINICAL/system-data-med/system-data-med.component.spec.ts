import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SystemDAtaMedComponent } from './system-data-med.component';

describe('SystemDAtaMedComponent', () => {
  let component: SystemDAtaMedComponent;
  let fixture: ComponentFixture<SystemDAtaMedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SystemDAtaMedComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SystemDAtaMedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
