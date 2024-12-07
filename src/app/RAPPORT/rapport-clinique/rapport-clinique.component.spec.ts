import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RapportCliniqueComponent } from './rapport-clinique.component';

describe('RapportCliniqueComponent', () => {
  let component: RapportCliniqueComponent;
  let fixture: ComponentFixture<RapportCliniqueComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RapportCliniqueComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RapportCliniqueComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
