import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UDAComptComponent } from './udacompt.component';

describe('UDAComptComponent', () => {
  let component: UDAComptComponent;
  let fixture: ComponentFixture<UDAComptComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ UDAComptComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UDAComptComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
