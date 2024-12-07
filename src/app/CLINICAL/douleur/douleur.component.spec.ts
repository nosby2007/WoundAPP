import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DouleurComponent } from './douleur.component';

describe('DouleurComponent', () => {
  let component: DouleurComponent;
  let fixture: ComponentFixture<DouleurComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DouleurComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DouleurComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
