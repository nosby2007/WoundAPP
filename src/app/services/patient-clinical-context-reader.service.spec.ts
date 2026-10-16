import { MobileClinicalContextFact } from './patient-clinical-context-reader.service';

describe('mobile clinical context contract', () => {
  it('keeps diagnosis provenance fields explicit for read-only progress-note context', () => {
    const fact: MobileClinicalContextFact = {
      id: 'dx-1',
      kind: 'diagnostic',
      code: 'L89.613',
      description: 'Pressure ulcer of right heel',
      status: 'active',
      reviewStatus: 'approved',
      primary: true,
      rank: 1,
      reaction: null,
      severity: null,
      sourceReference: 'Provider consult 10/15/2026',
    };

    expect(fact.reviewStatus).toBe('approved');
    expect(fact.sourceReference).toContain('Provider consult');
  });
});
