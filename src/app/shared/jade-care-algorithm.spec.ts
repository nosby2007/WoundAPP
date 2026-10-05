// src/app/shared/jade-care-algorithm.spec.ts
import {
  recommendJadeAlgorithm,
  evaluateStepVariances,
  BUILT_IN_JADE_ALGORITHMS,
} from './jade-care-algorithm';

describe('JADE Care Algorithm & Step Variance Engine', () => {
  it('recommends venous compression algorithm for venous ulcers with normal ABPI', () => {
    const res = recommendJadeAlgorithm(
      {
        woundType: 'Venous Stasis Ulcer',
        exudateAmount: 'Heavy',
        sloughPresent: false,
        escharPresent: false,
      },
      0.95
    );

    expect(res.recommendedAlgorithm).toBeTruthy();
    expect(res.recommendedAlgorithm?.category).toBe('venous');
    expect(res.contraindications.length).toBe(0);
  });

  it('flags strict contraindication to compression when ABPI < 0.5', () => {
    const res = recommendJadeAlgorithm(
      {
        woundType: 'Venous Ulcer',
        exudateAmount: 'Moderate',
      },
      0.42
    );

    expect(res.contraindications.some(c => c.includes('STRICT CONTRAINDICATION TO COMPRESSION'))).toBe(true);
    expect(res.recommendedAlgorithm?.category).toBe('arterial_neuropathic');
  });

  it('evaluates fully concordant execution when actual steps match prescribed routine', () => {
    const prescribed = {
      cleanse: ['Normal saline 0.9% irrigation'],
      prep: ['Zinc oxide barrier paste'],
      fillApply: ['Silver calcium alginate pad'],
      cover: ['Polyurethane foam pad'],
      secureWith: ['Tubular elastic stockinette'],
      frequency: 'Daily',
    };

    const actual = {
      cleanse: ['Normal saline 0.9% irrigation'],
      prep: ['Zinc oxide barrier paste'],
      fillApply: ['Silver calcium alginate pad'],
      cover: ['Polyurethane foam pad'],
      secureWith: ['Tubular elastic stockinette'],
      frequency: 'Daily',
    };

    const res = evaluateStepVariances({
      prescribedRoutine: prescribed,
      actualSteps: actual,
    });

    expect(res.variances.length).toBe(0);
    expect(res.overallStatus).toBe('fully_concordant');
  });

  it('detects step omission as clinical variance', () => {
    const prescribed = {
      cleanse: ['Normal saline 0.9% irrigation'],
      prep: ['Zinc oxide barrier paste'],
      fillApply: ['Silver calcium alginate pad'],
      cover: ['Polyurethane foam pad'],
      secureWith: ['Tubular elastic stockinette'],
    };

    const actual = {
      cleanse: ['Normal saline 0.9% irrigation'],
      prep: [], // Omitted prep
      fillApply: ['Silver calcium alginate pad'],
      cover: ['Polyurethane foam pad'],
      secureWith: ['Tubular elastic stockinette'],
    };

    const res = evaluateStepVariances({
      prescribedRoutine: prescribed,
      actualSteps: actual,
    });

    expect(res.variances.length).toBe(1);
    expect(res.variances[0].stepCategory).toBe('prep');
    expect(res.variances[0].varianceType).toBe('omission');
    expect(res.overallStatus).toBe('minor_variance');
  });

  it('detects step substitution with critical severity when primary therapeutic layer is replaced', () => {
    const prescribed = {
      fillApply: ['Cadexomer iodine paste'],
    };

    const actual = {
      fillApply: ['Hydrogel ointment'],
    };

    const res = evaluateStepVariances({
      prescribedRoutine: prescribed,
      actualSteps: actual,
    });

    expect(res.variances.length).toBe(1);
    expect(res.variances[0].stepCategory).toBe('fillApply');
    expect(res.variances[0].varianceType).toBe('substitution');
    expect(res.variances[0].varianceSeverity).toBe('high_clinical_divergence');
    expect(res.overallStatus).toBe('significant_variance');
  });
});
