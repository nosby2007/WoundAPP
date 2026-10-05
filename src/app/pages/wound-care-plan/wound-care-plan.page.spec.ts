import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pageTestProviders } from '../../../testing/page-test-providers';
import { WoundCarePlanPage } from './wound-care-plan.page';

describe('WoundCarePlanPage', () => {
  let component: WoundCarePlanPage;
  let fixture: ComponentFixture<WoundCarePlanPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: pageTestProviders({ patientId: 'p1', assessmentId: 'a1' }),
    });
    fixture = TestBed.createComponent(WoundCarePlanPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('offers no goals until a problem category is chosen', () => {
    // The catalog is filtered by category, the same way the web editor
    // filters it. Showing every org goal at once would invite picking one
    // that belongs to a different problem.
    expect(component.goalOptions).toEqual([]);
  });

  it('starts the plan today', () => {
    const today = new Date();
    const expected = [
      today.getFullYear(),
      `${today.getMonth() + 1}`.padStart(2, '0'),
      `${today.getDate()}`.padStart(2, '0'),
    ].join('-');
    expect(component.form.value.startDate).toBe(expected);
  });
});
