import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pageTestProviders } from '../../../testing/page-test-providers';
import { BradenFormPage } from './braden-form.page';

describe('BradenFormPage', () => {
  let component: BradenFormPage;
  let fixture: ComponentFixture<BradenFormPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: pageTestProviders({ patientId: 'p1' }) });
    fixture = TestBed.createComponent(BradenFormPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('offers no score until all six subscales are answered', () => {
    // The form opens with nothing selected, so the save button must stay
    // disabled: an unanswered Braden sums to 0, which would read as the
    // highest possible risk rather than as an empty form.
    expect(component.complete).toBe(false);

    component.form.patchValue({
      sensory: 4, moisture: 4, activity: 4, mobility: 4, nutrition: 4,
    });
    expect(component.complete).toBe(false);

    component.form.patchValue({ friction: 3 });
    expect(component.complete).toBe(true);
    expect(component.total).toBe(23);
    expect(component.riskText).toBe('Minimal / no risk');
  });
});
