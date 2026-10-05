// src/app/shared/clinical-safety-rules.ts
/**
 * Clinical Infection & Safety Rule Engine
 * Standards-compliant implementation of:
 * - NERDS Criteria (Superficial / Local Bacterial Burden)
 * - STONEES Criteria (Deep / Systemic Spreading Infection)
 * - ABPI Perfusion & Compression Safety Bounds
 */

export interface NerdsCriteriaItem {
  key: 'nonHealing' | 'exudateIncreased' | 'redBleeding' | 'debris' | 'smell';
  letter: 'N' | 'E' | 'R' | 'D' | 'S';
  name: string;
  description: string;
  met: boolean;
  clinicalEvidence: string | null;
}

export interface NerdsEvaluationResult {
  score: number;
  totalCriteria: number;
  isSuperficialInfectionSuspected: boolean;
  severity: 'none' | 'low' | 'moderate' | 'high_superficial';
  criteria: NerdsCriteriaItem[];
  clinicalSummary: string;
  prescriptiveGuidance: string[];
}

export interface StoneesCriteriaItem {
  key:
    | 'sizeIncreasing'
    | 'temperatureIncreased'
    | 'osProbesToBone'
    | 'newBreakdown'
    | 'erythemaExtended'
    | 'exudatePurulent'
    | 'smellFoul';
  letter: 'S' | 'T' | 'O' | 'N' | 'E' | 'E' | 'S';
  name: string;
  description: string;
  met: boolean;
  clinicalEvidence: string | null;
  isCriticalStandalone: boolean;
}

export interface StoneesEvaluationResult {
  score: number;
  totalCriteria: number;
  isDeepTissueInfectionSuspected: boolean;
  criticalStandaloneTriggered: boolean;
  severity: 'none' | 'low' | 'moderate' | 'critical_deep_systemic';
  criteria: StoneesCriteriaItem[];
  clinicalSummary: string;
  prescriptiveGuidance: string[];
  mandatoryActions: string[];
}

export type AbpiSafetyCategory =
  | 'critical_severe_ischemia'
  | 'moderate_arterial_disease'
  | 'normal_perfusion'
  | 'calcified_incompressible'
  | 'unassessed';

export type CompressionSafetyStatus =
  | 'strict_contraindicated'
  | 'modified_reduced_only'
  | 'full_compression_safe'
  | 'unreliable_requires_tbi'
  | 'requires_assessment';

export interface AbpiSafetyEvaluationResult {
  abpiValue: number | null;
  category: AbpiSafetyCategory;
  categoryLabel: string;
  severity: 'none' | 'info' | 'warning' | 'critical';
  compressionStatus: CompressionSafetyStatus;
  compressionStatusLabel: string;
  summary: string;
  contraindications: string[];
  recommendedActions: string[];
}

export interface ClinicalSafetySnapshot {
  nerds: NerdsEvaluationResult;
  stonees: StoneesEvaluationResult;
  abpi: AbpiSafetyEvaluationResult;
  compositeRiskLevel: 'stable' | 'caution' | 'urgent_attention' | 'immediate_escalation';
  activeAlerts: string[];
  evaluatedAt: Date;
}

export function evaluateNerds(input: {
  isNonHealing?: boolean;
  woundAgeDays?: number;
  areaReductionPercent2Weeks?: number;
  exudateAmount?: string | null;
  exudateIncreased?: boolean;
  granulationBleedsEasily?: boolean;
  hypergranulation?: boolean;
  sloughPercent?: number;
  sloughPresent?: boolean;
  escharPresent?: boolean;
  debrisPresent?: boolean;
  odorPresent?: boolean;
  odorType?: string | null;
  clinicalFindings?: string[];
}): NerdsEvaluationResult {
  const findings = (input.clinicalFindings || []).map(f => f.toLowerCase());
  const exudate = String(input.exudateAmount || '').toLowerCase();
  const odor = String(input.odorType || '').toLowerCase();

  const nMet =
    input.isNonHealing === true ||
    (input.woundAgeDays !== undefined && input.woundAgeDays > 28 && (input.areaReductionPercent2Weeks ?? 0) < 20) ||
    findings.some(f => f.includes('non-healing') || f.includes('stalled'));
  const nEvidence = nMet
    ? input.woundAgeDays
      ? `Wound age ${input.woundAgeDays}d with stalled area reduction (<20% in 2 weeks)`
      : 'Documented stagnant wound healing progression'
    : null;

  const eMet =
    input.exudateIncreased === true ||
    exudate === 'moderate' ||
    exudate === 'heavy' ||
    findings.some(f => f.includes('exudate') || f.includes('drainage increased'));
  const eEvidence = eMet
    ? input.exudateAmount
      ? `Drainage documented as ${input.exudateAmount}`
      : 'Exudate volume is increased above baseline'
    : null;

  const rMet =
    input.granulationBleedsEasily === true ||
    input.hypergranulation === true ||
    findings.some(f => f.includes('bleed') || f.includes('friable') || f.includes('hypergranulation'));
  const rEvidence = rMet ? 'Friable, hyperemic granulation tissue bleeds easily upon light touch' : null;

  const dMet =
    input.sloughPresent === true ||
    input.escharPresent === true ||
    input.debrisPresent === true ||
    (input.sloughPercent !== undefined && input.sloughPercent > 0) ||
    findings.some(f => f.includes('slough') || f.includes('eschar') || f.includes('debris') || f.includes('devitalized'));
  const dEvidence = dMet
    ? input.sloughPercent
      ? `Devitalized slough/eschar covering ${input.sloughPercent}% of wound bed`
      : 'Devitalized slough or necrotic tissue identified in wound base'
    : null;

  const sMet =
    input.odorPresent === true ||
    (odor.length > 0 && odor !== 'none') ||
    findings.some(f => f.includes('odor') || f.includes('smell') || f.includes('malodor'));
  const sEvidence = sMet
    ? input.odorType && input.odorType !== 'none'
      ? `Documented wound odor (${input.odorType})`
      : 'Noticeable offensive odor following cleansing'
    : null;

  const criteria: NerdsCriteriaItem[] = [
    {
      key: 'nonHealing',
      letter: 'N',
      name: 'Non-Healing',
      description: 'Wound present >4 weeks without 20-40% reduction, or healing stalled',
      met: nMet,
      clinicalEvidence: nEvidence,
    },
    {
      key: 'exudateIncreased',
      letter: 'E',
      name: 'Exudative / Increased',
      description: 'Moderate to heavy exudate or sudden change in moisture volume',
      met: eMet,
      clinicalEvidence: eEvidence,
    },
    {
      key: 'redBleeding',
      letter: 'R',
      name: 'Red & Friable Tissue',
      description: 'Granulation tissue bleeds easily or exhibits hypergranulation',
      met: rMet,
      clinicalEvidence: rEvidence,
    },
    {
      key: 'debris',
      letter: 'D',
      name: 'Debris in Wound Bed',
      description: 'Presence of slough, necrotic eschar, or devitalized cellular debris',
      met: dMet,
      clinicalEvidence: dEvidence,
    },
    {
      key: 'smell',
      letter: 'S',
      name: 'Smell / Malodor',
      description: 'Foul or pungent odor persisting after irrigation/cleansing',
      met: sMet,
      clinicalEvidence: sEvidence,
    },
  ];

  const score = criteria.filter(c => c.met).length;
  const isSuperficialInfectionSuspected = score >= 3;

  let severity: NerdsEvaluationResult['severity'] = 'none';
  if (score >= 3) severity = 'high_superficial';
  else if (score === 2) severity = 'moderate';
  else if (score === 1) severity = 'low';

  const prescriptiveGuidance: string[] = [];
  if (isSuperficialInfectionSuspected) {
    prescriptiveGuidance.push(
      'NERDS score >= 3: Superficial (local) increased bioburden / critical colonization suspected.',
      'Initiate targeted topical antimicrobial therapy (e.g. silver calcium alginate, cadexomer iodine, medical grade honey, or PHMB).',
      'Perform gentle conservative debridement to remove devitalized slough/biofilm.',
      'Systemic antibiotics are NOT indicated for local colonization unless STONEES deep infection criteria are triggered.'
    );
  } else if (score === 2) {
    prescriptiveGuidance.push(
      'NERDS score = 2: Borderline colonization risk. Monitor wound bed closely; optimize exudate management.'
    );
  }

  const clinicalSummary = isSuperficialInfectionSuspected
    ? `NERDS Positive (${score}/5 criteria): Superficial bacterial colonization suspected. Topical antimicrobial protocol indicated.`
    : `NERDS Negative (${score}/5 criteria): No critical superficial colonization detected.`;

  return {
    score,
    totalCriteria: 5,
    isSuperficialInfectionSuspected,
    severity,
    criteria,
    clinicalSummary,
    prescriptiveGuidance,
  };
}

export function evaluateStonees(input: {
  sizeIncreasing?: boolean;
  areaChangePercent?: number;
  depthIncreased?: boolean;
  temperatureIncreased?: boolean;
  temperatureDiffFahrenheit?: number;
  probesToBone?: boolean;
  boneVisible?: boolean;
  newBreakdownPresent?: boolean;
  satelliteLesions?: boolean;
  erythemaExtended?: boolean;
  erythemaDistanceCm?: number;
  indurationPresent?: boolean;
  exudatePurulent?: boolean;
  edemaPresent?: boolean;
  odorFoulPutrid?: boolean;
  clinicalFindings?: string[];
}): StoneesEvaluationResult {
  const findings = (input.clinicalFindings || []).map(f => f.toLowerCase());

  const sMet =
    input.sizeIncreasing === true ||
    (input.areaChangePercent !== undefined && input.areaChangePercent > 10) ||
    input.depthIncreased === true ||
    findings.some(f => f.includes('size increas') || f.includes('enlarging'));
  const sEvidence = sMet
    ? input.areaChangePercent
      ? `Surface area increased by ${input.areaChangePercent}%`
      : 'Wound surface area or depth enlargement documented'
    : null;

  const tMet =
    input.temperatureIncreased === true ||
    (input.temperatureDiffFahrenheit !== undefined && input.temperatureDiffFahrenheit >= 3) ||
    findings.some(f => f.includes('warmth') || f.includes('temperature') || f.includes('hot'));
  const tEvidence = tMet
    ? input.temperatureDiffFahrenheit
      ? `Periwound warmth +${input.temperatureDiffFahrenheit}°F compared to contralateral skin`
      : 'Periwound skin significantly warm to touch'
    : null;

  const oMet =
    input.probesToBone === true ||
    input.boneVisible === true ||
    findings.some(f => f.includes('probes to bone') || f.includes('bone palpable') || f.includes('bone visible'));
  const oEvidence = oMet ? 'Palpable hard bone contact with sterile probe or visible cortical bone' : null;

  const nMet =
    input.newBreakdownPresent === true ||
    input.satelliteLesions === true ||
    findings.some(f => f.includes('satellite') || f.includes('new breakdown') || f.includes('sinus'));
  const nEvidence = nMet ? 'New satellite ulcers, maceration breakdown, or new sinus tract formation' : null;

  const e1Met =
    input.erythemaExtended === true ||
    input.indurationPresent === true ||
    (input.erythemaDistanceCm !== undefined && input.erythemaDistanceCm >= 2) ||
    findings.some(f => f.includes('cellulitis') || f.includes('erythema > 2') || f.includes('induration'));
  const e1Evidence = e1Met
    ? input.erythemaDistanceCm
      ? `Periwound erythema extending ${input.erythemaDistanceCm} cm beyond margin with induration`
      : 'Periwound erythema > 2cm with palpable induration'
    : null;

  const e2Met =
    input.exudatePurulent === true ||
    input.edemaPresent === true ||
    findings.some(f => f.includes('purulent') || f.includes('pus') || f.includes('fluctuance'));
  const e2Evidence = e2Met ? 'Frank purulent exudate or significant local edema and fluctuance' : null;

  const s2Met =
    input.odorFoulPutrid === true ||
    findings.some(f => f.includes('putrid') || f.includes('foul') || f.includes('gangrenous'));
  const s2Evidence = s2Met ? 'Pungent, putrid, necrotic tissue odor' : null;

  const criteria: StoneesCriteriaItem[] = [
    {
      key: 'sizeIncreasing',
      letter: 'S',
      name: 'Size Increasing',
      description: 'Enlarging wound surface dimensions or deepening cavity',
      met: sMet,
      clinicalEvidence: sEvidence,
      isCriticalStandalone: false,
    },
    {
      key: 'temperatureIncreased',
      letter: 'T',
      name: 'Temperature Elevated',
      description: 'Periwound warmth (>3°F difference vs contralateral extremity)',
      met: tMet,
      clinicalEvidence: tEvidence,
      isCriticalStandalone: false,
    },
    {
      key: 'osProbesToBone',
      letter: 'O',
      name: 'Os (Probes to Bone)',
      description: 'Bone contact with metal probe or visible cortical bone (osteomyelitis high probability)',
      met: oMet,
      clinicalEvidence: oEvidence,
      isCriticalStandalone: true,
    },
    {
      key: 'newBreakdown',
      letter: 'N',
      name: 'New Areas of Breakdown',
      description: 'Satellite lesions, undermining extension, or periwound tissue breakdown',
      met: nMet,
      clinicalEvidence: nEvidence,
      isCriticalStandalone: false,
    },
    {
      key: 'erythemaExtended',
      letter: 'E',
      name: 'Erythema > 2 cm',
      description: 'Spreading periwound erythema >2cm from margin with induration/cellulitis',
      met: e1Met,
      clinicalEvidence: e1Evidence,
      isCriticalStandalone: false,
    },
    {
      key: 'exudatePurulent',
      letter: 'E',
      name: 'Exudate Purulent / Edema',
      description: 'Purulent thick drainage, localized edema, or tissue fluctuance',
      met: e2Met,
      clinicalEvidence: e2Evidence,
      isCriticalStandalone: false,
    },
    {
      key: 'smellFoul',
      letter: 'S',
      name: 'Smell / Foul Putrid Odor',
      description: 'Distinct foul, rotten, or anaerobic bacterial odor',
      met: s2Met,
      clinicalEvidence: s2Evidence,
      isCriticalStandalone: false,
    },
  ];

  const score = criteria.filter(c => c.met).length;
  const criticalStandaloneTriggered = oMet || (e1Met && e2Met);
  const isDeepTissueInfectionSuspected = score >= 3 || criticalStandaloneTriggered;

  let severity: StoneesEvaluationResult['severity'] = 'none';
  if (criticalStandaloneTriggered || score >= 4) severity = 'critical_deep_systemic';
  else if (score >= 3) severity = 'critical_deep_systemic';
  else if (score >= 1) severity = 'moderate';

  const prescriptiveGuidance: string[] = [];
  const mandatoryActions: string[] = [];

  if (isDeepTissueInfectionSuspected) {
    prescriptiveGuidance.push(
      'STONEES CRITICAL: Deep compartment or spreading infection suspected.',
      'Notify supervising Provider / MD immediately for systemic antibiotic evaluation.',
      'Obtain deep wound culture (Levine technique after thorough cleansing) or tissue biopsy.',
      oMet ? 'Probing to bone present: Osteomyelitis probability >85%. Order plain radiographs / MRI.' : 'Monitor for systemic signs of sepsis (fever, tachycardia, altered mental status).'
    );
    mandatoryActions.push(
      'Immediate provider co-signature notification',
      'Levine wound culture collection',
      oMet ? 'Urgent plain film / MRI imaging requisition for osteomyelitis' : 'Periwound erythema boundary marking with surgical pen'
    );
  } else if (score >= 1) {
    prescriptiveGuidance.push(
      `STONEES score = ${score}/7. Early signs of deep tissue involvement. Re-assess within 48 hours.`
    );
  }

  const clinicalSummary = isDeepTissueInfectionSuspected
    ? `STONEES POSITIVE (${score}/7 criteria${oMet ? ' + Probes to Bone' : ''}): High risk of deep tissue / systemic infection. Urgent physician escalation required.`
    : `STONEES Negative (${score}/7 criteria): No acute spreading deep infection identified.`;

  return {
    score,
    totalCriteria: 7,
    isDeepTissueInfectionSuspected,
    criticalStandaloneTriggered,
    severity,
    criteria,
    clinicalSummary,
    prescriptiveGuidance,
    mandatoryActions,
  };
}

export function evaluateAbpiSafety(abpi: number | null | undefined): AbpiSafetyEvaluationResult {
  if (abpi === null || abpi === undefined || Number.isNaN(abpi)) {
    return {
      abpiValue: null,
      category: 'unassessed',
      categoryLabel: 'ABPI Not Documented',
      severity: 'info',
      compressionStatus: 'requires_assessment',
      compressionStatusLabel: 'Perfusion Assessment Required',
      summary: 'No ABPI documented. Lower extremity compression requires verified baseline arterial perfusion.',
      contraindications: ['Do NOT apply high compression (>30 mmHg) until arterial perfusion is confirmed.'],
      recommendedActions: ['Perform hand-held Doppler ankle-brachial pressure index assessment.'],
    };
  }

  if (abpi < 0.5) {
    return {
      abpiValue: abpi,
      category: 'critical_severe_ischemia',
      categoryLabel: 'Severe Arterial Disease / Critical Limb Ischemia',
      severity: 'critical',
      compressionStatus: 'strict_contraindicated',
      compressionStatusLabel: 'COMPRESSION STRICTLY CONTRAINDICATED',
      summary: `ABPI ${abpi.toFixed(2)}: Critical limb ischemia detected. Severe arterial insufficiency.`,
      contraindications: [
        'STRICT CONTRAINDICATION: All forms of compression therapy (elastic, inelastic, or pneumatic).',
        'STRICT CONTRAINDICATION: Sharp or surgical debridement of dry stable eschar without revascularization.',
      ],
      recommendedActions: [
        'Immediate vascular surgical consultation for revascularization evaluation.',
        'Keep affected extremity warm, dry, and protected from pressure.',
        'Apply dry non-adherent protective dressings only.',
      ],
    };
  }

  if (abpi >= 0.5 && abpi < 0.8) {
    return {
      abpiValue: abpi,
      category: 'moderate_arterial_disease',
      categoryLabel: 'Moderate Arterial Insufficiency (Mixed Disease)',
      severity: 'warning',
      compressionStatus: 'modified_reduced_only',
      compressionStatusLabel: 'High Compression Contraindicated (Modified Only)',
      summary: `ABPI ${abpi.toFixed(2)}: Moderate arterial disease. Mixed venous-arterial ulceration likely.`,
      contraindications: [
        'CONTRAINDICATION: Standard high-compression therapy (30-40 mmHg or 4-layer systems).',
        'Avoid aggressive debridement near ischemic margins.',
      ],
      recommendedActions: [
        'Specialist physician order required prior to any reduced compression.',
        'Modified low-stretch compression (<20 mmHg) with frequent monitoring only if authorized.',
        'Schedule non-invasive arterial duplex ultrasound.',
      ],
    };
  }

  if (abpi >= 0.8 && abpi <= 1.3) {
    return {
      abpiValue: abpi,
      category: 'normal_perfusion',
      categoryLabel: 'Normal Arterial Perfusion',
      severity: 'none',
      compressionStatus: 'full_compression_safe',
      compressionStatusLabel: 'Therapeutic Compression Safe',
      summary: `ABPI ${abpi.toFixed(2)}: Adequate arterial inflow verified. Therapeutic compression is safe for venous hypertension.`,
      contraindications: [],
      recommendedActions: [
        'Proceed with therapeutic multi-layer compression (30-40 mmHg at ankle) if venous ulcer.',
        'Check pedal pulses and distal capillary refill following wrap application.',
      ],
    };
  }

  return {
    abpiValue: abpi,
    category: 'calcified_incompressible',
    categoryLabel: 'Calcified / Incompressible Arteries (Falsely Elevated)',
    severity: 'warning',
    compressionStatus: 'unreliable_requires_tbi',
    compressionStatusLabel: 'ABPI Unreliable - Verify with TBI',
    summary: `ABPI ${abpi.toFixed(2)}: Falsely elevated due to medial arterial calcification (common in diabetes and ESRD).`,
    contraindications: [
      'Do NOT assume normal perfusion based on elevated ABPI value.',
      'Avoid high compression until digital pressure is confirmed.',
    ],
    recommendedActions: [
      'Order Toe-Brachial Index (TBI) - digital vessels rarely calcify.',
      'Perform arterial Doppler waveform analysis (biphasic/triphasic vs monophasic).',
      'Assess for microvascular neuropathy and foot offloading needs.',
    ],
  };
}

export function generateClinicalSafetySnapshot(params: {
  nerdsInput: Parameters<typeof evaluateNerds>[0];
  stoneesInput: Parameters<typeof evaluateStonees>[0];
  abpiValue?: number | null;
}): ClinicalSafetySnapshot {
  const nerds = evaluateNerds(params.nerdsInput);
  const stonees = evaluateStonees(params.stoneesInput);
  const abpi = evaluateAbpiSafety(params.abpiValue);

  const activeAlerts: string[] = [];
  let compositeRiskLevel: ClinicalSafetySnapshot['compositeRiskLevel'] = 'stable';

  if (stonees.isDeepTissueInfectionSuspected || abpi.category === 'critical_severe_ischemia') {
    compositeRiskLevel = 'immediate_escalation';
    if (stonees.isDeepTissueInfectionSuspected) {
      activeAlerts.push(`CRITICAL INFECTION: STONEES ${stonees.score}/7 criteria met (Deep tissue infection risk).`);
    }
    if (abpi.category === 'critical_severe_ischemia') {
      activeAlerts.push(`CRITICAL PERFUSION: ABPI ${params.abpiValue?.toFixed(2)} - Severe ischemia. Compression strictly forbidden.`);
    }
  } else if (nerds.isSuperficialInfectionSuspected || abpi.category === 'moderate_arterial_disease' || abpi.category === 'calcified_incompressible') {
    compositeRiskLevel = 'urgent_attention';
    if (nerds.isSuperficialInfectionSuspected) {
      activeAlerts.push(`LOCAL INFECTION: NERDS ${nerds.score}/5 criteria met (Topical antimicrobial protocol indicated).`);
    }
    if (abpi.category === 'moderate_arterial_disease') {
      activeAlerts.push(`PERFUSION WARNING: ABPI ${params.abpiValue?.toFixed(2)} - Standard high-compression contraindicated.`);
    }
    if (abpi.category === 'calcified_incompressible') {
      activeAlerts.push(`ABPI UNRELIABLE: ABPI ${params.abpiValue?.toFixed(2)} - Incompressible vessels, order Toe-Brachial Index.`);
    }
  } else if (nerds.score > 0 || stonees.score > 0) {
    compositeRiskLevel = 'caution';
    activeAlerts.push(`Early bioburden markers detected: NERDS ${nerds.score}/5, STONEES ${stonees.score}/7.`);
  }

  return {
    nerds,
    stonees,
    abpi,
    compositeRiskLevel,
    activeAlerts,
    evaluatedAt: new Date(),
  };
}
