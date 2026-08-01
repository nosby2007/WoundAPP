import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WoundHistoryPage } from './wound-history.page';

describe('WoundHistoryPage', () => {
  let component: WoundHistoryPage;
  let fixture: ComponentFixture<WoundHistoryPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(WoundHistoryPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
