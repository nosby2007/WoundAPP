import { buildWoundTreatment } from './wound-treatment';

describe('buildWoundTreatment', () => {
  it('returns null when the nurse recorded none of it', () => {
    // Not an object full of blanks. The chart should say "not recorded",
    // not "no dressing applied".
    expect(buildWoundTreatment({})).toBeNull();
    expect(buildWoundTreatment({
      dressingAppearance: '', cleansing: '', debridement: '',
      primary: '', secondary: '', modalities: '', additionalCare: [],
    })).toBeNull();
  });

  it('is not null when only additional care was ticked', () => {
    const t = buildWoundTreatment({ additionalCare: ['Float heels'] });
    expect(t).not.toBeNull();
    expect(t!['additionalCare']).toEqual(['Float heels']);
  });

  it('writes only what was chosen', () => {
    const t = buildWoundTreatment({
      cleansing: 'Normal Saline',
      primary: 'Foam',
      additionalCare: [],
    })!;
    expect(t['cleansing']).toBe('Normal Saline');
    expect(t['primary']).toBe('Foam');
    expect('debridement' in t).toBe(false);
    expect('modalities' in t).toBe(false);
    expect('secondary' in t).toBe(false);
  });

  it('carries the free-text dressing only while the dressing is Other', () => {
    const other = buildWoundTreatment({
      primary: 'Other', primaryOther: 'Manuka honey',
      secondary: 'Other', secondaryOther: 'Tubular bandage',
    })!;
    expect(other['primaryOther']).toBe('Manuka honey');
    expect(other['secondaryOther']).toBe('Tubular bandage');

    // The nurse changed their mind: a leftover note under a named dressing
    // would read as a second, contradictory dressing.
    const named = buildWoundTreatment({
      primary: 'Foam', primaryOther: 'Manuka honey',
      secondary: 'Silicone', secondaryOther: 'Tubular bandage',
    })!;
    expect('primaryOther' in named).toBe(false);
    expect('secondaryOther' in named).toBe(false);
  });

  it('always carries additionalCare, so clearing it is stored', () => {
    // Unticking every box is a change to the plan of care; an omitted key
    // on an update would leave the old list in place.
    const t = buildWoundTreatment({ primary: 'Foam', additionalCare: [] })!;
    expect(t['additionalCare']).toEqual([]);
  });

  it('drops empty entries from additional care', () => {
    const t = buildWoundTreatment({
      additionalCare: ['Float heels', '', 'Pain management'],
    })!;
    expect(t['additionalCare']).toEqual(['Float heels', 'Pain management']);
  });
});
