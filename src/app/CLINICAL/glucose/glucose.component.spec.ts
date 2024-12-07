import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GlucoseComponent } from './glucose.component';

describe('GlucoseComponent', () => {
  let component: GlucoseComponent;
  let fixture: ComponentFixture<GlucoseComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ GlucoseComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GlucoseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
