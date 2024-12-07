import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TensionComponent } from './tension.component';

describe('TensionComponent', () => {
  let component: TensionComponent;
  let fixture: ComponentFixture<TensionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ TensionComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TensionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
