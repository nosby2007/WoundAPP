import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TableauBordComptComponent } from './tableau-bord-compt.component';

describe('TableauBordComptComponent', () => {
  let component: TableauBordComptComponent;
  let fixture: ComponentFixture<TableauBordComptComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ TableauBordComptComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TableauBordComptComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
