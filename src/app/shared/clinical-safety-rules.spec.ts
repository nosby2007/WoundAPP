// src/app/shared/clinical-safety-rules.spec.ts
import {
  evaluateNerds,
  evaluateStonees,
  evaluateAbpiSafety,
  generateClinicalSafetySnapshot,
} from './clinical-safety-rules';

describe('Clinical Safety Rule Engine (NERDS / STONEES & ABPI)', () => {
  describe('NERDS (Superficial Infection / Local Bioburden)', () => {
    it('returns score 0 and negative infection when wound is clean', () => {
      const res = evaluateNerds({
        isNonHealing: false,
        exudateAmount: 'None',
        sloughPresent: false,
        odorPresent: false,
      });

      expect(res.score).toBe(0);
      expect(res.isSuperficialInfectionSuspected).toBe(false);
    });

    it('identifies superficial infection when >= 3 NERDS criteria are met', () => {
      const res = evaluateNerds({
        isNonHealing: true, // N
        exudateAmount: 'Heavy', // E
        granulationBleedsEasily: true, // R
        sloughPresent: true, // D
        odorPresent: true, // S
      });

      expect(res.score).toBe(5);
      expect(res.isSuperficialInfectionSuspected).toBe(true);
      expect(res.prescriptiveGuidance.some(g => g.includes('topical antimicrobial'))).toBe(true);
    });
  });

  describe('STONEES (Deep / Spreading Infection)', () => {
    it('triggers critical standalone escalation when probe contacts bone (Os)', () => {
      const res = evaluateStonees({
        probesToBone: true, // O
      });

      expect(res.criticalStandaloneTriggered).toBe(true);
      expect(res.isDeepTissueInfectionSuspected).toBe(true);
      expect(res.mandatoryActions.some(a => a.includes('plain film / MRI'))).toBe(true);
    });

    it('detects deep spreading infection when >= 3 criteria are met', () => {
      const res = evaluateStonees({
        sizeIncreasing: true, // S
        temperatureIncreased: true, // T
        erythemaExtended: true, // E (>2 cm)
        exudatePurulent: true, // E
      });

      expect(res.score).toBe(4);
      expect(res.isDeepTissueInfectionSuspected).toBe(true);
      expect(res.mandatoryActions.some(a => a.includes('provider co-signature notification'))).toBe(true);
    });
  });

  describe('ABPI Safety Bounds', () => {
    it('strictly contraindicates compression when ABPI < 0.5', () => {
      const res = evaluateAbpiSafety(0.45);
      expect(res.severity).toBe('critical');
      expect(res.compressionStatus).toBe('strict_contraindicated');
      expect(res.contraindications.some(c => c.includes('STRICT CONTRAINDICATION: All forms of compression'))).toBe(true);
    });

    it('requires modified reduced compression when ABPI is between 0.5 and 0.8', () => {
      const res = evaluateAbpiSafety(0.68);
      expect(res.severity).toBe('warning');
      expect(res.compressionStatus).toBe('modified_reduced_only');
    });

    it('allows full therapeutic compression when ABPI is normal (0.8 - 1.3)', () => {
      const res = evaluateAbpiSafety(1.05);
      expect(res.severity).toBe('none');
      expect(res.compressionStatus).toBe('full_compression_safe');
    });

    it('warns of falsely elevated incompressible vessels when ABPI > 1.3', () => {
      const res = evaluateAbpiSafety(1.42);
      expect(res.severity).toBe('warning');
      expect(res.compressionStatus).toBe('unreliable_requires_tbi');
      expect(res.recommendedActions.some(a => a.includes('Toe-Brachial Index'))).toBe(true);
    });
  });

  describe('Integrated Safety Snapshot', () => {
    it('sets immediate_escalation risk level when deep infection or severe ischemia present', () => {
      const snap = generateClinicalSafetySnapshot({
        nerdsInput: {},
        stoneesInput: { probesToBone: true },
        abpiValue: 0.45,
      });

      expect(snap.compositeRiskLevel).toBe('immediate_escalation');
      expect(snap.activeAlerts.length).toBeGreaterThan(0);
    });
  });
});
