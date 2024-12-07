import { ComponentFixture, TestBed } from '@angular/core/testing';

import { POCComponent } from './poc.component';

describe('POCComponent', () => {
  let component: POCComponent;
  let fixture: ComponentFixture<POCComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ POCComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(POCComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
