import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PoidsSignesVComponent } from './poids-signes-v.component';

describe('PoidsSignesVComponent', () => {
  let component: PoidsSignesVComponent;
  let fixture: ComponentFixture<PoidsSignesVComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PoidsSignesVComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PoidsSignesVComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
