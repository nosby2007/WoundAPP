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

  it('applies an admin template problem and keeps its provenance', () => {
    component.catalog = [{
      id: 'catalog-goal-1',
      kind: 'goal',
      category: 'potential_for_compromised_skin_integrity',
      text: 'Organization-authored goal',
      sourceTemplateId: 'template-1',
      sourceTemplateName: 'Wound healing plan',
      sourceTemplateProblemId: 'skin-integrity',
      sourceTemplateProblemLabel: 'Wound healing',
      sourceTemplateGoalId: 'goal-1',
    }];

    component.applyTemplateProblem('template-1::skin-integrity');

    expect(component.form.value.title).toBe('Wound healing');
    expect(component.form.value.category).toBe('potential_for_compromised_skin_integrity');
    expect(component.selectedTemplateProblem?.templateId).toBe('template-1');
    expect(component.selectedTemplateProblem?.goals[0].text).toBe('Organization-authored goal');
  });

  it('clears governed selections when the problem category changes', () => {
    component.selectedGoalIds.add('goal-1');
    component.selectedInterventionIds.add('intervention-1');

    component.onCategoryChanged('infection');

    expect(component.selectedGoalIds.size).toBe(0);
    expect(component.selectedInterventionIds.size).toBe(0);
  });
});
