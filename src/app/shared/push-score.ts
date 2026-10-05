// src/app/shared/push-score.ts
/**
 * Pressure Ulcer Scale for Healing (PUSH Tool 3.0) & Trajectory Calculation Engine
 * Developed by the National Pressure Injury Advisory Panel (NPIAP).
 */

export interface PushScoreBreakdown {
  lengthCm: number;
  widthCm: number;
  depthCm?: number;
  areaCm2: number;
  areaScore: number;
  exudateAmount: string;
  exudateScore: number;
  tissueType: string;
  tissueScore: number;
  totalPushScore: number;
}

export interface TrajectoryDataPoint {
  assessmentId: string;
  date: Date;
  dateLabel: string;
  areaCm2: number;
  volumeCm3?: number;
  depthCm?: number;
  pushScore: number;
  pushBreakdown: PushScoreBreakdown;
  percentChangeFromBaseline?: number;
  percentChangeFromPrevious?: number;
  status: 'progressing' | 'stagnant' | 'deteriorating' | 'baseline';
  stage?: string;
  type?: string;
  hasInfectionMarkers?: boolean;
}

export interface BedsideHealingTrajectory {
  woundId: string;
  points: TrajectoryDataPoint[];
  baselinePoint: TrajectoryDataPoint | null;
  latestPoint: TrajectoryDataPoint | null;
  overallPercentAreaReduction: number;
  overallPushReduction: number;
  trajectoryClassification:
    | 'rapidly_healing'
    | 'healing_on_target'
    | 'stalled_delayed'
    | 'deteriorating'
    | 'insufficient_data';
  daysTracked: number;
  weeklyHealingRateCm2: number;
  projectedWeeksToClosure: number | null;
  clinicalRecommendations: string[];
}

export function calculatePushAreaScore(areaCm2: number): number {
  if (areaCm2 <= 0) return 0;
  if (areaCm2 < 0.3) return 1;
  if (areaCm2 <= 0.6) return 2;
  if (areaCm2 <= 1.0) return 3;
  if (areaCm2 <= 2.0) return 4;
  if (areaCm2 <= 3.0) return 5;
  if (areaCm2 <= 4.0) return 6;
  if (areaCm2 <= 8.0) return 7;
  if (areaCm2 <= 12.0) return 8;
  if (areaCm2 <= 24.0) return 9;
  return 10;
}

export function calculatePushExudateScore(exudateAmount: string | null | undefined): number {
  const norm = String(exudateAmount || '').toLowerCase();
  if (norm === 'heavy' || norm === 'large' || norm === 'copious') return 3;
  if (norm === 'moderate' || norm === 'medium') return 2;
  if (norm === 'light' || norm === 'scant' || norm === 'small') return 1;
  return 0;
}

export function calculatePushTissueScore(tissueInput: {
  isClosed?: boolean;
  epithelialPercent?: number;
  granulationPercent?: number;
  sloughPercent?: number;
  escharPresent?: boolean;
  rawTissue?: string | null;
}): number {
  if (tissueInput.isClosed) return 0;
  if (tissueInput.escharPresent || (tissueInput.rawTissue && tissueInput.rawTissue.toLowerCase().includes('eschar'))) {
    return 4;
  }
  if ((tissueInput.sloughPercent && tissueInput.sloughPercent > 0) || (tissueInput.rawTissue && tissueInput.rawTissue.toLowerCase().includes('slough'))) {
    return 3;
  }
  if ((tissueInput.granulationPercent && tissueInput.granulationPercent > 0) || (tissueInput.rawTissue && tissueInput.rawTissue.toLowerCase().includes('granulation'))) {
    return 2;
  }
  if (tissueInput.epithelialPercent && tissueInput.epithelialPercent > 0) {
    return 1;
  }
  return 2;
}

export function calculatePushScore(params: {
  length?: number | null;
  width?: number | null;
  depth?: number | null;
  exudateAmount?: string | null;
  tissueType?: string | null;
  sloughPresent?: boolean;
  escharPresent?: boolean;
  isClosed?: boolean;
}): PushScoreBreakdown {
  const l = Number(params.length) || 0;
  const w = Number(params.width) || 0;
  const d = Number(params.depth) || 0;
  const areaCm2 = Math.round(l * w * 100) / 100;

  const areaScore = calculatePushAreaScore(areaCm2);
  const exudateScore = calculatePushExudateScore(params.exudateAmount);
  const tissueScore = calculatePushTissueScore({
    isClosed: params.isClosed,
    escharPresent: params.escharPresent,
    sloughPercent: params.sloughPresent ? 25 : 0,
    rawTissue: params.tissueType,
  });

  const totalPushScore = areaScore + exudateScore + tissueScore;

  return {
    lengthCm: l,
    widthCm: w,
    depthCm: d,
    areaCm2,
    areaScore,
    exudateAmount: params.exudateAmount || 'None',
    exudateScore,
    tissueType: params.tissueType || (params.escharPresent ? 'Eschar' : params.sloughPresent ? 'Slough' : 'Granulation'),
    tissueScore,
    totalPushScore,
  };
}

export function computeHealingTrajectory(
  woundId: string,
  rawAssessments: any[]
): BedsideHealingTrajectory {
  if (!rawAssessments || !rawAssessments.length) {
    return {
      woundId,
      points: [],
      baselinePoint: null,
      latestPoint: null,
      overallPercentAreaReduction: 0,
      overallPushReduction: 0,
      trajectoryClassification: 'insufficient_data',
      daysTracked: 0,
      weeklyHealingRateCm2: 0,
      projectedWeeksToClosure: null,
      clinicalRecommendations: ['Record at least two wound assessments to establish healing trajectory.'],
    };
  }

  const sorted = [...rawAssessments].sort((a, b) => {
    const da = a.assessedAt instanceof Date ? a.assessedAt.getTime() : new Date(a.assessedAt || a.createdAt).getTime();
    const db = b.assessedAt instanceof Date ? b.assessedAt.getTime() : new Date(b.assessedAt || b.createdAt).getTime();
    return da - db;
  });

  const points: TrajectoryDataPoint[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    const m = a.measurements || {};
    const describe = a.describe || {};
    const woundBed = a.woundBed || {};
    const exudate = a.exudate || {};

    const l = Number(m.length) || Number(a.length) || 0;
    const w = Number(m.width) || Number(a.width) || 0;
    const d = Number(m.depth) || Number(a.depth) || 0;
    const area = Math.round(l * w * 100) / 100;
    const volume = Math.round(l * w * d * 100) / 100;

    const date = a.assessedAt instanceof Date ? a.assessedAt : new Date(a.assessedAt || a.createdAt || Date.now());

    const push = calculatePushScore({
      length: l,
      width: w,
      depth: d,
      exudateAmount: exudate.amount || a.exudateAmount,
      tissueType: describe.tissueType || woundBed.primaryTissue,
      sloughPresent: woundBed.slough?.present === true || a.sloughPresent === true,
      escharPresent: woundBed.eschar === true || a.escharPresent === true,
      isClosed: a.status === 'healed' || a.status === 'closed',
    });

    const hasInfection = Array.isArray(woundBed.infection) && woundBed.infection.length > 0;

    let percentChangeFromBaseline: number | undefined;
    let percentChangeFromPrevious: number | undefined;
    let status: TrajectoryDataPoint['status'] = 'baseline';

    if (i === 0) {
      status = 'baseline';
      percentChangeFromBaseline = 0;
    } else {
      const baselineArea = points[0].areaCm2;
      const prevArea = points[i - 1].areaCm2;

      if (baselineArea > 0) {
        percentChangeFromBaseline = Math.round(((baselineArea - area) / baselineArea) * 100);
      } else {
        percentChangeFromBaseline = 0;
      }

      if (prevArea > 0) {
        percentChangeFromPrevious = Math.round(((prevArea - area) / prevArea) * 100);
      }

      if (percentChangeFromPrevious !== undefined) {
        if (percentChangeFromPrevious >= 10) status = 'progressing';
        else if (percentChangeFromPrevious <= -10) status = 'deteriorating';
        else status = 'stagnant';
      }
    }

    points.push({
      assessmentId: a.id,
      date,
      dateLabel: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      areaCm2: area,
      volumeCm3: volume,
      depthCm: d,
      pushScore: push.totalPushScore,
      pushBreakdown: push,
      percentChangeFromBaseline,
      percentChangeFromPrevious,
      status,
      stage: describe.stage || a.stage,
      type: describe.type || a.type,
      hasInfectionMarkers: hasInfection,
    });
  }

  const baseline = points[0];
  const latest = points[points.length - 1];

  let overallPercentAreaReduction = 0;
  if (baseline.areaCm2 > 0) {
    overallPercentAreaReduction = Math.round(((baseline.areaCm2 - latest.areaCm2) / baseline.areaCm2) * 100);
  }

  const overallPushReduction = baseline.pushScore - latest.pushScore;

  const msElapsed = latest.date.getTime() - baseline.date.getTime();
  const daysTracked = Math.max(1, Math.round(msElapsed / (1000 * 60 * 60 * 24)));
  const weeksTracked = daysTracked / 7;

  const areaReductionAbs = baseline.areaCm2 - latest.areaCm2;
  const weeklyHealingRateCm2 = weeksTracked > 0 ? Math.round((areaReductionAbs / weeksTracked) * 100) / 100 : 0;

  let projectedWeeksToClosure: number | null = null;
  if (weeklyHealingRateCm2 > 0 && latest.areaCm2 > 0) {
    projectedWeeksToClosure = Math.ceil(latest.areaCm2 / weeklyHealingRateCm2);
  }

  let trajectoryClassification: BedsideHealingTrajectory['trajectoryClassification'] = 'insufficient_data';
  const recommendations: string[] = [];

  if (points.length < 2) {
    trajectoryClassification = 'insufficient_data';
    recommendations.push('Baseline established. Conduct follow-up assessment in 7 days to evaluate trajectory.');
  } else if (overallPercentAreaReduction >= 40 || (weeksTracked <= 2 && overallPercentAreaReduction >= 20)) {
    trajectoryClassification = 'rapidly_healing';
    recommendations.push(
      'Wound is progressing rapidly (>20-40% area reduction). Maintain current JADE protocol and dressing schedule.',
      'Protect delicate neo-epithelium at wound margins.'
    );
  } else if (overallPercentAreaReduction >= 15) {
    trajectoryClassification = 'healing_on_target';
    recommendations.push(
      'Wound is healing on target. Continue active moisture balance and bioburden suppression.',
      projectedWeeksToClosure ? `Estimated closure in ~${projectedWeeksToClosure} weeks at current progression.` : 'Monitor weekly.'
    );
  } else if (overallPercentAreaReduction > -10 && overallPercentAreaReduction < 15) {
    trajectoryClassification = 'stalled_delayed';
    recommendations.push(
      'HEALING STALLED (<15% reduction over tracked period).',
      'Re-evaluate etiology: check for unrecognized bioburden, pressure/shearing, edema, or arterial compromise.',
      'Consider advancing JADE algorithm to cellular / tissue-based product (CTP) or active enzymatic debridement.'
    );
  } else {
    trajectoryClassification = 'deteriorating';
    recommendations.push(
      'CRITICAL: Wound is deteriorating (surface area or depth enlarging).',
      'Trigger immediate provider bedside review and order co-signature.',
      'Screen immediately using STONEES criteria for deep compartment infection or osteomyelitis.'
    );
  }

  return {
    woundId,
    points,
    baselinePoint: baseline,
    latestPoint: latest,
    overallPercentAreaReduction,
    overallPushReduction,
    trajectoryClassification,
    daysTracked,
    weeklyHealingRateCm2,
    projectedWeeksToClosure,
    clinicalRecommendations: recommendations,
  };
}
