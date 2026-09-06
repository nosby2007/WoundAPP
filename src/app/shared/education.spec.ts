import { educationGaps, educationIsRecordable, EducationDraft } from './education';

const draft = (over: Partial<EducationDraft> = {}): EducationDraft => ({
  topic: '', category: null, learners: [], readiness: null,
  method: [], response: [], woundId: null, notes: null, ...over,
});

describe('education', () => {
  it('needs a topic and somebody it was taught to', () => {
    // "Wound care was explained" with nobody named documents nothing.
    expect(educationIsRecordable(draft({ topic: 'Pressure relief' }))).toBe(false);
    expect(educationIsRecordable(draft({ learners: ['patient'] }))).toBe(false);
    expect(educationIsRecordable(draft({ topic: 'Pressure relief', learners: ['patient'] }))).toBe(true);
  });

  it('does not accept whitespace as a topic', () => {
    expect(educationIsRecordable(draft({ topic: '   ', learners: ['patient'] }))).toBe(false);
  });

  it('names readiness and method as expected, without enforcing them', () => {
    const gaps = educationGaps(draft({ topic: 'Pressure relief', learners: ['patient'] }));
    expect(gaps).toEqual(['Readiness', 'How it was delivered']);
    // Still recordable: a half-recorded session at a bedside is worth more
    // than an abandoned one.
    expect(educationIsRecordable(draft({ topic: 'Pressure relief', learners: ['patient'] }))).toBe(true);
  });

  it('treats a refusal as complete on its own', () => {
    // A patient who refuses teaching has been taught nothing. Asking for a
    // method and a response would push the nurse into claiming a session
    // that did not happen.
    const gaps = educationGaps(draft({
      topic: 'Pressure relief', learners: ['patient'], readiness: 'refuses',
    }));
    expect(gaps).toEqual([]);
  });

  it('reports nothing missing once the expected fields are there', () => {
    const gaps = educationGaps(draft({
      topic: 'Pressure relief',
      learners: ['patient', 'caregiver'],
      readiness: 'acceptance',
      method: ['explanation', 'demonstration'],
    }));
    expect(gaps).toEqual([]);
  });
});
