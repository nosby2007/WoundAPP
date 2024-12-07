import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NouveauProComponent } from './nouveau-pro.component';

describe('NouveauProComponent', () => {
  let component: NouveauProComponent;
  let fixture: ComponentFixture<NouveauProComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ NouveauProComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NouveauProComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
