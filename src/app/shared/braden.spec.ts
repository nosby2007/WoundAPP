import {
  bradenActionGroups,
  bradenIsComplete,
  bradenRiskClass,
  bradenRiskText,
  bradenTotal,
  buildBradenAnswers,
  BRADEN_FRICTION,
  BRADEN_SENSORY,
} from './braden';

/**
 * The scale is ported, not invented, so what these pin is that the port did
 * not drift: the same subscales must produce the same total and the same risk
 * band as the web app, or one chart will say "high risk" and the other "at
 * risk" about the same patient on the same day.
 */
describe('Braden scoring', () => {
  it('runs 6 to 23, not 6 to 24', () => {
    // Friction/shear has three options, the other five have four. That
    // asymmetry is the scale; losing it would shift every threshold.
    expect(BRADEN_FRICTION.length).toBe(3);
    expect(BRADEN_SENSORY.length).toBe(4);

    const lowest = { sensory: 1, moisture: 1, activity: 1, mobility: 1, nutrition: 1, friction: 1 };
    const highest = { sensory: 4, moisture: 4, activity: 4, mobility: 4, nutrition: 4, friction: 3 };
    expect(bradenTotal(lowest)).toBe(6);
    expect(bradenTotal(highest)).toBe(23);
  });

  it('bands the total the way the web app bands it', () => {
    expect(bradenRiskText(6)).toBe('Very high risk');
    expect(bradenRiskText(9)).toBe('Very high risk');
    expect(bradenRiskText(10)).toBe('High risk');
    expect(bradenRiskText(12)).toBe('High risk');
    expect(bradenRiskText(13)).toBe('Moderate risk');
    expect(bradenRiskText(14)).toBe('Moderate risk');
    expect(bradenRiskText(15)).toBe('At risk');
    expect(bradenRiskText(18)).toBe('At risk');
    expect(bradenRiskText(19)).toBe('Minimal / no risk');
    expect(bradenRiskText(23)).toBe('Minimal / no risk');
  });

  it('uses the same boundaries for the risk class', () => {
    expect(bradenRiskClass(9)).toBe('vh');
    expect(bradenRiskClass(12)).toBe('h');
    expect(bradenRiskClass(14)).toBe('m');
    expect(bradenRiskClass(18)).toBe('r');
    expect(bradenRiskClass(19)).toBe('n');
  });

  it('treats a missing subscale as unanswered, not as zero', () => {
    const partial = { sensory: 3, moisture: 3, activity: 3, mobility: 3, nutrition: 3, friction: null };
    expect(bradenIsComplete(partial)).toBe(false);
    // bradenTotal would happily return 15 here, which is why the form must
    // ask bradenIsComplete() before it saves.
    expect(bradenTotal(partial)).toBe(15);
  });

  it('is complete only when all six are answered', () => {
    expect(bradenIsComplete({
      sensory: 1, moisture: 2, activity: 3, mobility: 4, nutrition: 2, friction: 3,
    })).toBe(true);
  });

  it('writes the answers object the web Braden list reads', () => {
    const at = new Date('2026-09-06T14:30:00.000Z');
    const answers = buildBradenAnswers(
      { sensory: 2, moisture: 3, activity: 2, mobility: 2, nutrition: 3, friction: 2 },
      at,
    );

    // braden-list.component.ts reads doc.answers.braden.{sensory,...} and
    // recomputes the total, so these names are load-bearing.
    expect(answers['sensory']).toBe(2);
    expect(answers['friction']).toBe(2);
    expect(answers['date']).toBe(at);
    expect(answers['total']).toBe(14);
    expect(answers['riskText']).toBe('Moderate risk');
  });
});

describe('bradenActionGroups', () => {
  const catalog = [
    { subscale: 'sensory', score: 3, text: 'Turn every hour side to side' },
    { subscale: 'sensory', score: 3, text: 'Offload the heel' },
    { subscale: 'sensory', score: 1, text: 'Something for a different answer' },
    { subscale: 'mobility', score: 2, text: 'Turn side to side' },
    { subscale: 'friction', score: 3, text: '   ' },
  ];

  it('shows only the actions for the answer that was given', () => {
    const groups = bradenActionGroups(
      { sensory: 3, moisture: null, activity: null, mobility: null, nutrition: null, friction: null },
      catalog,
    );
    expect(groups.length).toBe(1);
    expect(groups[0].subscale).toBe('sensory');
    expect(groups[0].score).toBe(3);
    expect(groups[0].actions).toEqual(['Turn every hour side to side', 'Offload the heel']);
  });

  it('skips a subscale that has no answer yet', () => {
    // Not "nothing to do here" -- nobody has said anything about it. Listing
    // it empty would be a statement the form has not earned.
    const groups = bradenActionGroups(
      { sensory: null, moisture: null, activity: null, mobility: null, nutrition: null, friction: null },
      catalog,
    );
    expect(groups).toEqual([]);
  });

  it('keeps an answered subscale the org has written nothing for', () => {
    // The screen says so, which is true and is actionable: an admin can add
    // them. Dropping it would leave the nurse thinking the score needs
    // nothing.
    const groups = bradenActionGroups(
      { sensory: null, moisture: 4, activity: null, mobility: null, nutrition: null, friction: null },
      catalog,
    );
    expect(groups.length).toBe(1);
    expect(groups[0].subscale).toBe('moisture');
    expect(groups[0].actions).toEqual([]);
  });

  it('orders groups the way the form asks the questions', () => {
    const groups = bradenActionGroups(
      { sensory: 3, moisture: null, activity: null, mobility: 2, nutrition: null, friction: 3 },
      catalog,
    );
    expect(groups.map((g) => g.subscale)).toEqual(['sensory', 'mobility', 'friction']);
  });

  it('drops a blank catalog entry rather than rendering an empty bullet', () => {
    const groups = bradenActionGroups(
      { sensory: null, moisture: null, activity: null, mobility: null, nutrition: null, friction: 3 },
      catalog,
    );
    expect(groups[0].actions).toEqual([]);
  });

  it('shows nothing at all when the org catalog is empty', () => {
    const groups = bradenActionGroups(
      { sensory: 3, moisture: null, activity: null, mobility: null, nutrition: null, friction: null },
      [],
    );
    expect(groups.length).toBe(1);
    expect(groups[0].actions).toEqual([]);
  });
});
