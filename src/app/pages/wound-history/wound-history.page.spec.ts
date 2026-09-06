import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pageTestProviders } from '../../../testing/page-test-providers';
import { WoundHistoryPage } from './wound-history.page';

describe('WoundHistoryPage', () => {
  let component: WoundHistoryPage;
  let fixture: ComponentFixture<WoundHistoryPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: pageTestProviders({ patientId: 'p1', woundId: 'w1' }) });
    fixture = TestBed.createComponent(WoundHistoryPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
