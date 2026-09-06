import { carePlanCategoryLabel, splitLines, todayIsoDate } from './care-plan';

describe('care plan helpers', () => {
  it('labels a category, and says nothing for one it does not know', () => {
    expect(carePlanCategoryLabel('fall_prevention')).toBe('Fall prevention');
    // Never a raw enum value in front of a clinician, and never a guess.
    expect(carePlanCategoryLabel('not_a_category')).toBe('');
    expect(carePlanCategoryLabel(null)).toBe('');
  });

  it('splits custom goals one per line, the way the web editor does', () => {
    expect(splitLines('  Heal by 30 days \n\n Keep heel offloaded\n')).toEqual([
      'Heal by 30 days',
      'Keep heel offloaded',
    ]);
    expect(splitLines('')).toEqual([]);
    expect(splitLines(null)).toEqual([]);
  });

  it('dates the plan in the device timezone, not UTC', () => {
    // A visit at 8pm local on the 6th is a plan started on the 6th. Taking
    // the date off an ISO string would file it as the 7th for anyone west
    // of Greenwich in the evening.
    const evening = new Date(2026, 8, 6, 20, 30);
    expect(todayIsoDate(evening)).toBe('2026-09-06');

    const newYearsEve = new Date(2026, 11, 31, 23, 59);
    expect(todayIsoDate(newYearsEve)).toBe('2026-12-31');
  });
});
