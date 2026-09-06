import {
  groupAssessmentsByWound,
  latestAssessmentPerWound,
  resolveWoundId,
  stripWoundIdForUpdate,
  woundIdForCreate,
} from './wound-identity';

/**
 * The bug these exist for: the re-evaluation button passed ?woundId= and the
 * form never read it, so every re-evaluation taken in the field opened a new
 * wound in the chart. Nothing failed. The registry simply grew.
 */
describe('wound identity', () => {
  describe('woundIdForCreate', () => {
    it('keeps a re-evaluation on its parent wound', () => {
      expect(woundIdForCreate('wound-1', 'assessment-9')).toBe('wound-1');
    });

    it('makes a new wound its own identity', () => {
      // Same value the web's `assessment.woundId ?? assessment.id` fallback
      // computes -- written down instead of inferred, so the grouping no
      // longer depends on a fallback holding.
      expect(woundIdForCreate(null, 'assessment-9')).toBe('assessment-9');
      expect(woundIdForCreate(undefined, 'assessment-9')).toBe('assessment-9');
    });

    it('treats a blank route parameter as no parent', () => {
      // '' and '  ' arrive from a hand-edited or truncated URL. Storing one
      // would be a wound whose id is empty: grouped with every other such
      // assessment, on any patient.
      expect(woundIdForCreate('', 'assessment-9')).toBe('assessment-9');
      expect(woundIdForCreate('   ', 'assessment-9')).toBe('assessment-9');
    });
  });

  describe('stripWoundIdForUpdate', () => {
    it('removes the key so an edit cannot move an assessment', () => {
      const payload = { woundId: 'wrong', 'measurements': { length: 3 } };
      const out = stripWoundIdForUpdate(payload);
      expect('woundId' in out).toBe(false);
      expect(out['measurements']).toEqual({ length: 3 });
    });

    it('does not mutate the payload it was given', () => {
      const payload = { woundId: 'wound-1' };
      stripWoundIdForUpdate(payload);
      expect(payload.woundId).toBe('wound-1');
    });

    it('is a no-op on a payload that never had one', () => {
      expect(stripWoundIdForUpdate({ a: 1 })).toEqual({ a: 1 });
    });
  });

  describe('resolveWoundId', () => {
    it('prefers the stored identity', () => {
      expect(resolveWoundId({ woundId: 'wound-1', id: 'assessment-9' })).toBe('wound-1');
    });

    it('falls back to the assessment id for legacy documents', () => {
      expect(resolveWoundId({ id: 'assessment-9' })).toBe('assessment-9');
      expect(resolveWoundId({ woundId: null, id: 'assessment-9' })).toBe('assessment-9');
      expect(resolveWoundId({ woundId: '  ', id: 'assessment-9' })).toBe('assessment-9');
    });

    it('resolves nothing rather than guessing', () => {
      expect(resolveWoundId(null)).toBeNull();
      expect(resolveWoundId({})).toBeNull();
    });
  });
});

describe('latestAssessmentPerWound', () => {
  const at = (iso: string) => new Date(iso);

  it('keeps one row per wound, the newest one', () => {
    const rows = latestAssessmentPerWound([
      { id: 'a1', woundId: 'w1', assessedAt: at('2026-09-01T10:00:00Z') },
      { id: 'a2', woundId: 'w1', assessedAt: at('2026-09-06T10:00:00Z') },
      { id: 'a3', woundId: 'w2', assessedAt: at('2026-09-05T10:00:00Z') },
    ]);
    expect(rows.map((r) => r.id)).toEqual(['a2', 'a3']);
  });

  it('groups a legacy assessment by its own id, as the web does', () => {
    const rows = latestAssessmentPerWound([
      { id: 'a1', assessedAt: at('2026-09-01T10:00:00Z') },
      { id: 'a2', assessedAt: at('2026-09-02T10:00:00Z') },
    ]);
    // Two wounds, because that is what the chart already shows for these.
    expect(rows.length).toBe(2);
  });

  it('does not let an undated assessment displace a dated one', () => {
    // "No recorded time" is not "now". Letting it win would make the note
    // report an older set of measurements as current.
    const rows = latestAssessmentPerWound([
      { id: 'dated', woundId: 'w1', assessedAt: at('2026-09-06T10:00:00Z') },
      { id: 'undated', woundId: 'w1', assessedAt: null },
    ]);
    expect(rows.map((r) => r.id)).toEqual(['dated']);
  });

  it('still returns an undated assessment when it is all there is', () => {
    const rows = latestAssessmentPerWound([{ id: 'only', woundId: 'w1', assessedAt: null }]);
    expect(rows.map((r) => r.id)).toEqual(['only']);
  });

  it('skips a row that resolves to no wound at all', () => {
    const rows = latestAssessmentPerWound([{ assessedAt: at('2026-09-06T10:00:00Z') }]);
    expect(rows).toEqual([]);
  });

  it('lists the most recently assessed wound first', () => {
    const rows = latestAssessmentPerWound([
      { id: 'older', woundId: 'w1', assessedAt: at('2026-09-01T10:00:00Z') },
      { id: 'newer', woundId: 'w2', assessedAt: at('2026-09-06T10:00:00Z') },
    ]);
    expect(rows.map((r) => r.id)).toEqual(['newer', 'older']);
  });
});

describe('groupAssessmentsByWound', () => {
  const at = (iso: string) => new Date(iso);

  it('shows a re-evaluated wound once, not twice', () => {
    // The reported bug: the web grouped these into one wound and the mobile
    // list still showed two rows -- a second wound to dress, with its own
    // healing trajectory, in an app whose job is to say how many wounds
    // this patient has.
    const groups = groupAssessmentsByWound([
      { id: 'a1', woundId: 'w1', assessedAt: at('2026-09-01T10:00:00Z') },
      { id: 'a2', woundId: 'w1', assessedAt: at('2026-09-06T10:00:00Z') },
    ]);
    expect(groups.length).toBe(1);
    expect(groups[0].woundId).toBe('w1');
    expect(groups[0].latest.id).toBe('a2');
  });

  it('counts the assessments behind the one it shows', () => {
    const groups = groupAssessmentsByWound([
      { id: 'a1', woundId: 'w1', assessedAt: at('2026-09-01T10:00:00Z') },
      { id: 'a2', woundId: 'w1', assessedAt: at('2026-09-03T10:00:00Z') },
      { id: 'a3', woundId: 'w1', assessedAt: at('2026-09-06T10:00:00Z') },
      { id: 'b1', woundId: 'w2', assessedAt: at('2026-09-05T10:00:00Z') },
    ]);
    expect(groups.map((g) => [g.woundId, g.assessmentCount])).toEqual([
      ['w1', 3], ['w2', 1],
    ]);
  });

  it('counts an undated assessment even though it cannot be the latest', () => {
    // It is still history. Leaving it out of the count would under-report
    // how much is behind the wound.
    const groups = groupAssessmentsByWound([
      { id: 'dated', woundId: 'w1', assessedAt: at('2026-09-06T10:00:00Z') },
      { id: 'undated', woundId: 'w1', assessedAt: null },
    ]);
    expect(groups[0].assessmentCount).toBe(2);
    expect(groups[0].latest.id).toBe('dated');
  });

  it('keeps separate wounds separate', () => {
    const groups = groupAssessmentsByWound([
      { id: 'a1', woundId: 'w1', assessedAt: at('2026-09-01T10:00:00Z') },
      { id: 'b1', woundId: 'w2', assessedAt: at('2026-09-06T10:00:00Z') },
    ]);
    expect(groups.map((g) => g.woundId)).toEqual(['w2', 'w1']);
  });

  it('agrees with latestAssessmentPerWound', () => {
    // Both apps and the progress note must count wounds the same way; the
    // two helpers are one rule, and this pins that they stay so.
    const rows = [
      { id: 'a1', woundId: 'w1', assessedAt: at('2026-09-01T10:00:00Z') },
      { id: 'a2', woundId: 'w1', assessedAt: at('2026-09-06T10:00:00Z') },
      { id: 'b1', woundId: 'w2', assessedAt: at('2026-09-05T10:00:00Z') },
    ];
    expect(latestAssessmentPerWound(rows)).toEqual(
      groupAssessmentsByWound(rows).map((g) => g.latest));
  });
});
