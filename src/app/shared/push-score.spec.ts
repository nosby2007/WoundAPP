// src/app/shared/push-score.spec.ts
import {
  calculatePushScore,
  calculatePushAreaScore,
  computeHealingTrajectory,
} from './push-score';

describe('PUSH Tool 3.0 & Healing Trajectory Engine', () => {
  describe('calculatePushAreaScore', () => {
    it('calculates accurate subscores according to NPIAP PUSH Tool', () => {
      expect(calculatePushAreaScore(0)).toBe(0);
      expect(calculatePushAreaScore(0.25)).toBe(1);
      expect(calculatePushAreaScore(0.5)).toBe(2);
      expect(calculatePushAreaScore(0.9)).toBe(3);
      expect(calculatePushAreaScore(1.8)).toBe(4);
      expect(calculatePushAreaScore(2.5)).toBe(5);
      expect(calculatePushAreaScore(3.8)).toBe(6);
      expect(calculatePushAreaScore(6.0)).toBe(7);
      expect(calculatePushAreaScore(10.5)).toBe(8);
      expect(calculatePushAreaScore(18.0)).toBe(9);
      expect(calculatePushAreaScore(30.0)).toBe(10);
    });
  });

  describe('calculatePushScore', () => {
    it('calculates full PUSH score (0 to 17)', () => {
      // Area = 2 x 3 = 6 cm² -> Area score: 7
      // Exudate = Moderate -> Exudate score: 2
      // Tissue = Slough -> Tissue score: 3
      // Total = 7 + 2 + 3 = 12
      const res = calculatePushScore({
        length: 2,
        width: 3,
        depth: 0.5,
        exudateAmount: 'Moderate',
        sloughPresent: true,
      });

      expect(res.areaCm2).toBe(6);
      expect(res.areaScore).toBe(7);
      expect(res.exudateScore).toBe(2);
      expect(res.tissueScore).toBe(3);
      expect(res.totalPushScore).toBe(12);
    });
  });

  describe('computeHealingTrajectory', () => {
    it('classifies rapidly healing wounds when area reduction is >= 40%', () => {
      const now = new Date();
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      const assessments = [
        {
          id: 'a1',
          assessedAt: twoWeeksAgo,
          measurements: { length: 4, width: 4, depth: 1 }, // 16 cm²
          exudate: { amount: 'Heavy' },
        },
        {
          id: 'a2',
          assessedAt: now,
          measurements: { length: 2, width: 2, depth: 0.2 }, // 4 cm² (-75% area reduction)
          exudate: { amount: 'Light' },
        },
      ];

      const traj = computeHealingTrajectory('w1', assessments);

      expect(traj.points.length).toBe(2);
      expect(traj.overallPercentAreaReduction).toBe(75);
      expect(traj.trajectoryClassification).toBe('rapidly_healing');
      expect(traj.weeklyHealingRateCm2).toBeGreaterThan(0);
    });

    it('identifies deteriorating wounds when surface area increases', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const assessments = [
        {
          id: 'a1',
          assessedAt: past,
          measurements: { length: 2, width: 2, depth: 0.5 }, // 4 cm²
        },
        {
          id: 'a2',
          assessedAt: now,
          measurements: { length: 3, width: 3, depth: 1.0 }, // 9 cm² (+125% increase)
        },
      ];

      const traj = computeHealingTrajectory('w1', assessments);

      expect(traj.overallPercentAreaReduction).toBeLessThan(0);
      expect(traj.trajectoryClassification).toBe('deteriorating');
      expect(traj.clinicalRecommendations.some(r => r.includes('CRITICAL: Wound is deteriorating'))).toBe(true);
    });
  });
});
