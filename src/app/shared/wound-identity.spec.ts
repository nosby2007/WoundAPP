import {
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
