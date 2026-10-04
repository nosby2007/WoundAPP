import { canFacilitateTelehealth, isVirtualVisit } from './telehealth-policy';

describe('field telehealth boundaries', () => {
  it('permits nurses and rejects nonclinical operational roles', () => {
    expect(canFacilitateTelehealth(['RN'])).toBeTrue();
    for (const role of ['billing', 'surveyor', 'caregiver', 'supplier']) {
      expect(canFacilitateTelehealth([role])).toBeFalse();
    }
  });
  it('distinguishes virtual appointments from physical EVV visits', () => {
    expect(isVirtualVisit('telehealth_video')).toBeTrue();
    expect(isVirtualVisit('telehealth_audio')).toBeTrue();
    expect(isVirtualVisit('physical')).toBeFalse();
    expect(isVirtualVisit(undefined)).toBeFalse();
  });
});
