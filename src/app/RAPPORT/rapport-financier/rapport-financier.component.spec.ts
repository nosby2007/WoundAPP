import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RapportFinancierComponent } from './rapport-financier.component';

describe('RapportFinancierComponent', () => {
  let component: RapportFinancierComponent;
  let fixture: ComponentFixture<RapportFinancierComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RapportFinancierComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RapportFinancierComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
