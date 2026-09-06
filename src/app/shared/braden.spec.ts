import {
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
