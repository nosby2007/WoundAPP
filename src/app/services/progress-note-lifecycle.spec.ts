import { newProgressNoteLifecycle } from './progress-note.service';

describe('mobile progress-note lifecycle', () => {
  it('creates an explicit unsigned draft for JADE review and sign', () => {
    expect(newProgressNoteLifecycle()).toEqual({
      status: 'draft',
      draft: true,
      signed: false,
      signedAt: null,
      signedByUid: null,
      signatureIdentity: null,
      version: 1,
      rootNoteId: null,
      supersedesNoteId: null,
      amendmentReason: null,
    });
  });
});
