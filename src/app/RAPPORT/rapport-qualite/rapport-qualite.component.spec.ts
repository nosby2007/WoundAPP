import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RapportQualiteComponent } from './rapport-qualite.component';

describe('RapportQualiteComponent', () => {
  let component: RapportQualiteComponent;
  let fixture: ComponentFixture<RapportQualiteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RapportQualiteComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RapportQualiteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
