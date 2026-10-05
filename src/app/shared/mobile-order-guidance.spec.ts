import { deriveMobileAlgorithmGuidance } from './mobile-order-guidance';

describe('deriveMobileAlgorithmGuidance', () => {
  it('suggests venous + wet categories from documented findings', () => {
    const result = deriveMobileAlgorithmGuidance({
      woundType: 'Venous',
      exudateAmount: 'Moderate',
      sloughPresent: false,
      escharPresent: false,
      infectionFindings: ['None'],
      infectionStatus: 'None',
    });

    expect(result.suggestedTypes).toContain('venous');
    expect(result.suggestedTypes).toContain('wet');
    expect(result.suggestedTypes).not.toContain('compression');
    expect(result.suggestedTypes).not.toContain('npwt');
  });

  it('suggests wet-necrotic when necrosis and heavy exudate are documented', () => {
    const result = deriveMobileAlgorithmGuidance({
      woundType: 'Pressure',
      exudateAmount: 'Heavy',
      sloughPresent: true,
      escharPresent: false,
      infectionFindings: ['None'],
      infectionStatus: 'None',
    });

    expect(result.suggestedTypes).toContain('wet_necrotic');
  });

  it('surfaces infection as a caution, not an automatic therapy choice', () => {
    const result = deriveMobileAlgorithmGuidance({
      woundType: 'Surgical',
      exudateAmount: 'Light',
      sloughPresent: false,
      escharPresent: false,
      infectionFindings: ['Warmth'],
      infectionStatus: 'Suspected',
    });

    expect(result.cautions.some(value => value.includes('Provider review is required'))).toBeTrue();
    expect(result.suggestedTypes).not.toContain('compression');
    expect(result.suggestedTypes).not.toContain('npwt');
  });
});
