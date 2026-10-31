import { bodyProfileFromPatientGender, positionForZone, selectAnatomicalZone, zonesForView } from './wound-anatomy';

describe('wound anatomy', () => {
  it('uses patient laterality rather than screen laterality on the front view', () => {
    expect(selectAnatomicalZone('front', 43, 79, 'male')?.label).toBe('Right anterior lower leg');
    expect(selectAnatomicalZone('front', 57, 79, 'female')?.label).toBe('Left anterior lower leg');
  });

  it('keeps back-view laterality aligned with the patient', () => {
    expect(selectAnatomicalZone('back', 43, 80, 'female')?.label).toBe('Left posterior calf');
    expect(selectAnatomicalZone('back', 57, 94, 'male')?.label).toBe('Right posterior heel');
  });

  it('rejects taps outside a recognized anatomical zone', () => {
    expect(selectAnatomicalZone('front', 4, 4, 'male')).toBeNull();
    expect(zonesForView('front').length).toBeGreaterThan(20);
    expect(positionForZone('back-sacrum', 'female')?.label).toBe('sacrum');
  });

  it('maps only explicit patient gender values to an avatar profile', () => {
    expect(bodyProfileFromPatientGender('Female')).toBe('female');
    expect(bodyProfileFromPatientGender('M')).toBe('male');
    expect(bodyProfileFromPatientGender('nonbinary')).toBeNull();
    expect(bodyProfileFromPatientGender(null)).toBeNull();
  });

  it('filters sex-specific clinical regions without dropping shared anatomy', () => {
    const femaleIds = zonesForView('front', 'female').map(zone => zone.id);
    const maleIds = zonesForView('front', 'male').map(zone => zone.id);
    expect(femaleIds).toContain('front-vaginal-area');
    expect(femaleIds).not.toContain('front-penis');
    expect(maleIds).toContain('front-penis');
    expect(maleIds).not.toContain('front-vaginal-area');
    expect(femaleIds).toContain('front-right-fingers');
    expect(positionForZone('front-right-lower-abdomen', 'male')?.label).toBe('Right lower anterior abdomen');
  });
});
