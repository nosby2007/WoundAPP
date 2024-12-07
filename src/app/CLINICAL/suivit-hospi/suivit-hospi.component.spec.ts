import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SuivitHospiComponent } from './suivit-hospi.component';

describe('SuivitHospiComponent', () => {
  let component: SuivitHospiComponent;
  let fixture: ComponentFixture<SuivitHospiComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SuivitHospiComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SuivitHospiComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
