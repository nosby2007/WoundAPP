// src/app/shared/jade-care-algorithm.ts
/**
 * Shared JADE Care Algorithm Contract & Step Variance Engine
 * Integrates WoundAPP mobile execution with JADE-SHOP authoring platform.
 */

import { MobileWoundGuidanceInput } from './mobile-order-guidance';

export type JadeStepCategory =
  | 'cleanse'
  | 'prep'
  | 'fillApply'
  | 'cover'
  | 'secureWith'
  | 'compression'
  | 'offloading'
  | 'frequency'
  | 'specialInstructions';

export type StepVarianceType =
  | 'concordant'
  | 'omission'
  | 'substitution'
  | 'addition'
  | 'frequency_change';

export type VarianceReasonCode =
  | 'clinical_contraindication'
  | 'patient_intolerance'
  | 'supply_unavailable'
  | 'provider_verbal_order'
  | 'wound_bed_improved'
  | 'wound_bed_deteriorated'
  | 'infection_escalation'
  | 'other';

export type VarianceSeverity = 'none' | 'low' | 'moderate' | 'high_clinical_divergence';

export interface MobileStepVariance {
  stepCategory: JadeStepCategory;
  stepLabel: string;
  prescribed: string[];
  actual: string[];
  varianceType: StepVarianceType;
  reasonCode?: VarianceReasonCode | null;
  reasonExplanation?: string | null;
  varianceSeverity: VarianceSeverity;
  reviewedByClinicalRole?: string | null;
}

export interface JadeAlgorithmStepOption {
  id: string;
  label: string;
  category: JadeStepCategory;
  required?: boolean;
  selectedByDefault?: boolean;
  contraindications?: string[];
  rationale?: string;
}

export interface JadeCareAlgorithm {
  id: string;
  orgId: string;
  name: string;
  code: string;
  category: string;
  version: number;
  active: boolean;
  description: string;
  evidenceBase?: string;
  inclusionCriteria: {
    woundTypes?: string[];
    exudateLevels?: string[];
    tissueTypes?: string[];
    minAbpi?: number;
    maxAbpi?: number;
  };
  recommendedDefaults: {
    frequency: string;
    duration: string;
    priority: 'routine' | 'urgent' | 'stat';
  };
  steps: {
    specialInstructions?: JadeAlgorithmStepOption[];
    cleanse: JadeAlgorithmStepOption[];
    prep: JadeAlgorithmStepOption[];
    fillApply: JadeAlgorithmStepOption[];
    cover: JadeAlgorithmStepOption[];
    secureWith: JadeAlgorithmStepOption[];
    compression?: JadeAlgorithmStepOption[];
    offloading?: JadeAlgorithmStepOption[];
  };
  safetyCautions: string[];
}

export interface MobileOrderExecutionInput {
  orderId: string;
  patientId: string;
  woundId?: string | null;
  visitId?: string | null;
  fieldEncounterVisitId?: string | null;
  episodeId?: string | null;
  performedAt: Date | string;
  actualSteps: {
    specialInstructions?: string[];
    cleanse: string[];
    prep: string[];
    fillApply: string[];
    cover: string[];
    secureWith: string[];
    compression?: string[];
    offloading?: string[];
    frequency?: string | null;
  };
  suppliesUsed?: Array<{ supplyId?: string; name: string; quantity: number; unit?: string }>;
  variances: MobileStepVariance[];
  overallVarianceStatus: 'fully_concordant' | 'minor_variance' | 'significant_variance';
  clinicianNotes?: string | null;
  patientTolerated: 'well' | 'moderate_pain' | 'severe_discomfort' | 'refused_partial';
  painScoreBefore?: number | null;
  painScoreAfter?: number | null;
}

export const BUILT_IN_JADE_ALGORITHMS: JadeCareAlgorithm[] = [
  {
    id: 'jade-alg-venous-wet',
    orgId: 'shared-canonical',
    name: 'JADE Venous Leg Ulcer - Exudate Control & Multi-Layer Compression',
    code: 'JADE-VLU-01',
    category: 'venous',
    version: 2,
    active: true,
    description: 'Evidence-based management for venous hypertension ulcers with moderate to heavy drainage and verified arterial safety (ABPI >= 0.8).',
    evidenceBase: 'WOCN Venous Ulcer Clinical Practice Guideline (Grade 1A for multi-layer sustained compression)',
    inclusionCriteria: {
      woundTypes: ['venous', 'venous stasis', 'stasis ulcer'],
      exudateLevels: ['moderate', 'heavy'],
      minAbpi: 0.8,
    },
    recommendedDefaults: {
      frequency: '2-3 times per week',
      duration: '4-6 weeks with re-evaluation',
      priority: 'routine',
    },
    steps: {
      specialInstructions: [
        { id: 'inst-elevate', label: 'Elevate lower extremities above heart level 30 min tid', category: 'specialInstructions' },
        { id: 'inst-emollient', label: 'Apply fragrance-free emollient to intact calf skin', category: 'specialInstructions' },
      ],
      cleanse: [
        { id: 'cl-saline', label: 'Normal saline 0.9% irrigation with gentle mechanical rinse', category: 'cleanse', selectedByDefault: true },
        { id: 'cl-phmb', label: 'PHMB surfactant soak for 10-15 minutes if bioburden suspected', category: 'cleanse' },
      ],
      prep: [
        { id: 'pr-skin-protect', label: 'Zinc oxide moisture barrier paste to peri-wound edge', category: 'prep', selectedByDefault: true },
        { id: 'pr-cavilon', label: 'No-sting barrier film (acrylic terpolymer) circumferentially', category: 'prep' },
      ],
      fillApply: [
        { id: 'fa-cadex', label: 'Cadexomer iodine paste / ointment 3mm thick layer', category: 'fillApply' },
        { id: 'fa-silver-alginate', label: 'Silver calcium alginate pad packed to depth without overlap', category: 'fillApply', selectedByDefault: true },
        { id: 'fa-honey', label: 'Medical grade Leptospermum honey dressing', category: 'fillApply' },
      ],
      cover: [
        { id: 'cv-foam', label: 'Hydrocellular polyurethane foam non-adhesive pad', category: 'cover', selectedByDefault: true },
        { id: 'cv-superabsorb', label: 'Super-absorbent polymer pad for high exudate', category: 'cover' },
      ],
      secureWith: [
        { id: 'sec-tubular', label: 'Conforming tubular elastic stockinette layer', category: 'secureWith', selectedByDefault: true },
        { id: 'sec-cohesive', label: 'Cohesive flexible self-adherent bandage (no tension)', category: 'secureWith' },
      ],
      compression: [
        { id: 'comp-4layer', label: '4-layer multi-component compression bandage system (40 mmHg at ankle)', category: 'compression', selectedByDefault: true },
        { id: 'comp-shortstretch', label: 'Short-stretch zinc paste bandage (Unna boot) with self-adherent wrap', category: 'compression' },
        { id: 'comp-velcro', label: 'Inelastic adjustable compression wrap with hook-and-loop closures', category: 'compression' },
      ],
    },
    safetyCautions: [
      'STRICT SAFETY RULE: Do NOT apply compression if ABPI is below 0.8 without vascular surgery authorization.',
      'Check peripheral pulse and capillary refill prior to and immediately following compression application.',
      'Instruct patient to immediately remove bandages if sudden severe foot/toe pain, numbness, or cyanosis occurs.',
    ],
  },
  {
    id: 'jade-alg-arterial-dry',
    orgId: 'shared-canonical',
    name: 'JADE Arterial / Ischemic / Neuropathic - Moisture Protection & Non-Debridement',
    code: 'JADE-ART-01',
    category: 'arterial_neuropathic',
    version: 2,
    active: true,
    description: 'Protective protocol for poorly perfused or neuropathic ulcers. Emphasizes dry protective dressing and strictly forbids aggressive sharp debridement on dry eschar without perfusion.',
    evidenceBase: 'IWGDF Diabetic Foot Ulcer Guidelines; SVS Arterial Wound Standards',
    inclusionCriteria: {
      woundTypes: ['arterial', 'ischemic', 'neuropathic', 'diabetic foot ulcer'],
      exudateLevels: ['none', 'light'],
      maxAbpi: 0.8,
    },
    recommendedDefaults: {
      frequency: 'Every 2 to 3 days and prn strike-through',
      duration: '4 weeks with urgent vascular consult',
      priority: 'urgent',
    },
    steps: {
      specialInstructions: [
        { id: 'inst-no-comp', label: 'DO NOT APPLY COMPRESSION - severe arterial compromise', category: 'specialInstructions', required: true },
        { id: 'inst-offload', label: 'Total offloading boot or therapeutic diabetic footwear mandatory', category: 'specialInstructions' },
      ],
      cleanse: [
        { id: 'cl-povidone', label: 'Povidone-iodine 10% swab to maintain dry, sterile eschar', category: 'cleanse', selectedByDefault: true },
        { id: 'cl-saline-dry', label: 'Sterile saline rinse; thoroughly pat dry with sterile gauze', category: 'cleanse' },
      ],
      prep: [
        { id: 'pr-skin-prep', label: 'Non-sting skin protective wipe to surrounding intact skin', category: 'prep', selectedByDefault: true },
      ],
      fillApply: [
        { id: 'fa-dry-gauze', label: 'Dry sterile non-adherent petrolatum gauze contact layer', category: 'fillApply', selectedByDefault: true },
        { id: 'fa-iodophor', label: 'Dry iodophor impregnated gauze (do not moisten dry gangrene)', category: 'fillApply' },
      ],
      cover: [
        { id: 'cv-dry-gauze-pad', label: 'Dry sterile 4x4 woven gauze sponges (fluffed)', category: 'cover', selectedByDefault: true },
      ],
      secureWith: [
        { id: 'sec-roll-gauze', label: 'Rolled tubular gauze loosely wrapped, tape to itself only (no skin tape)', category: 'secureWith', selectedByDefault: true },
      ],
      offloading: [
        { id: 'off-boot', label: 'Removable cast walker / offloading healing shoe', category: 'offloading', selectedByDefault: true },
      ],
    },
    safetyCautions: [
      'CONTRAINDICATION: Sharp or surgical debridement of dry stable eschar is strictly contraindicated without arterial revascularization.',
      'CONTRAINDICATION: Compression wraps and tight circumferential taping are contraindicated.',
    ],
  },
  {
    id: 'jade-alg-wet-necrotic',
    orgId: 'shared-canonical',
    name: 'JADE Wet Necrotic Debridement & Bioburden Suppression',
    code: 'JADE-WET-NEC-01',
    category: 'wet_necrotic',
    version: 2,
    active: true,
    description: 'Targeted bio-enzymatic and autolytic debridement protocol for wounds with devitalized slough/eschar with moderate to heavy exudate.',
    evidenceBase: 'WOCN Wound Debridement & Moisture Balance Framework',
    inclusionCriteria: {
      exudateLevels: ['moderate', 'heavy'],
      tissueTypes: ['slough', 'soft eschar'],
    },
    recommendedDefaults: {
      frequency: 'Daily to every other day',
      duration: '2 to 3 weeks until clean granulation bed achieved',
      priority: 'routine',
    },
    steps: {
      specialInstructions: [
        { id: 'inst-sharp', label: 'Assess for bedside cross-hatching or conservative sharp debridement if certified', category: 'specialInstructions' },
      ],
      cleanse: [
        { id: 'cl-hypochlorous', label: 'Hypochlorous acid (HOCl) antimicrobial wound cleanser soak 10 min', category: 'cleanse', selectedByDefault: true },
        { id: 'cl-pulsed', label: 'Sterile water/saline irrigation with 35mL syringe and 19G angiocatheter', category: 'cleanse' },
      ],
      prep: [
        { id: 'pr-zinc', label: 'Zinc oxide / dimethicone barrier cream to entire periwound zone', category: 'prep', selectedByDefault: true },
      ],
      fillApply: [
        { id: 'fa-collagenase', label: 'Collagenase enzymatic debriding ointment nickel-thick layer', category: 'fillApply', selectedByDefault: true },
        { id: 'fa-silver-collagenase', label: 'Silver nitrate cautery to hypergranulation if prescribed', category: 'fillApply' },
        { id: 'fa-iodosorb', label: 'Cadexomer iodine gel (debridement + sustained antimicrobial)', category: 'fillApply' },
      ],
      cover: [
        { id: 'cv-foam-silver', label: 'Silver-impregnated polyurethane foam dressing', category: 'cover', selectedByDefault: true },
        { id: 'cv-absorb-pad', label: 'Non-bordered hydrocellular absorption pad', category: 'cover' },
      ],
      secureWith: [
        { id: 'sec-tubular-net', label: 'Tubular elastic retention bandage netting', category: 'secureWith', selectedByDefault: true },
        { id: 'sec-hypo-tape', label: 'Hypoallergenic microporous surgical paper tape', category: 'secureWith' },
      ],
    },
    safetyCautions: [
      'Do NOT use silver dressings simultaneously with collagenase enzymatic ointment as heavy metals inactivate the enzyme.',
      'Protect peri-wound skin aggressively against maceration caused by enzymatic liquefaction of slough.',
    ],
  },
  {
    id: 'jade-alg-pressure-granulating',
    orgId: 'shared-canonical',
    name: 'JADE Pressure Injury - Granulation Promotion & Cell Proliferation',
    code: 'JADE-PI-01',
    category: 'pressure_injury',
    version: 2,
    active: true,
    description: 'Protocol for clean Stage 3/4 or unstageable recovering pressure injuries focusing on granulation proliferation, depth filling, and moisture equilibrium.',
    evidenceBase: 'NPUAP/EPUAP/PPPIA International Clinical Practice Guideline for Pressure Injuries',
    inclusionCriteria: {
      woundTypes: ['pressure injury', 'pressure ulcer', 'decubitus'],
      tissueTypes: ['granulation', 'clean wound bed'],
    },
    recommendedDefaults: {
      frequency: 'Every 2 to 3 days',
      duration: '4-8 weeks',
      priority: 'routine',
    },
    steps: {
      specialInstructions: [
        { id: 'inst-turn', label: 'Patient repositioning schedule q2h with 30-degree lateral tilt', category: 'specialInstructions', required: true },
        { id: 'inst-surface', label: 'Dynamic low air loss or alternating pressure mattress verified', category: 'specialInstructions' },
      ],
      cleanse: [
        { id: 'cl-gentle-saline', label: 'Warm sterile 0.9% normal saline gentle irrigation', category: 'cleanse', selectedByDefault: true },
      ],
      prep: [
        { id: 'pr-cavilon-film', label: 'Advanced moisture barrier film to intact peri-wound', category: 'prep', selectedByDefault: true },
      ],
      fillApply: [
        { id: 'fa-collagen-matrix', label: 'Native bovine collagen extracellular matrix powder / sheet', category: 'fillApply', selectedByDefault: true },
        { id: 'fa-hydrogel', label: 'Amorphous hydrogel dressing for gentle autolysis and hydration', category: 'fillApply' },
      ],
      cover: [
        { id: 'cv-bordered-sacral', label: 'Silicone-bordered 5-layer foam sacral/heel dressing with redistribution core', category: 'cover', selectedByDefault: true },
      ],
      secureWith: [
        { id: 'sec-silicone-border', label: 'Self-adherent silicone adhesive border (no secondary tape)', category: 'secureWith', selectedByDefault: true },
      ],
    },
    safetyCautions: [
      'Avoid massage over bony prominences.',
      'Ensure dead space is loosely packed; over-packing creates capillary pressure and causes ischemic necrosis of the wound base.',
    ],
  },
];

export function evaluateStepVariances(params: {
  prescribedRoutine: {
    cleanse?: string[];
    prep?: string[];
    fillApply?: string[];
    cover?: string[];
    secureWith?: string[];
    compression?: string[];
    offloading?: string[];
    frequency?: string | null;
    specialInstructions?: string[];
  };
  actualSteps: {
    cleanse?: string[];
    prep?: string[];
    fillApply?: string[];
    cover?: string[];
    secureWith?: string[];
    compression?: string[];
    offloading?: string[];
    frequency?: string | null;
    specialInstructions?: string[];
  };
  clinicianReasons?: Record<string, { code: VarianceReasonCode; explanation: string }>;
}): { variances: MobileStepVariance[]; overallStatus: 'fully_concordant' | 'minor_variance' | 'significant_variance' } {
  const variances: MobileStepVariance[] = [];
  const categories: Array<{ key: JadeStepCategory; label: string }> = [
    { key: 'cleanse', label: 'Cleanse' },
    { key: 'prep', label: 'Peri-wound Prep' },
    { key: 'fillApply', label: 'Fill / Topical Application' },
    { key: 'cover', label: 'Cover Dressing' },
    { key: 'secureWith', label: 'Securement' },
    { key: 'compression', label: 'Compression Therapy' },
    { key: 'offloading', label: 'Offloading Device' },
    { key: 'specialInstructions', label: 'Special Instructions' },
  ];

  let hasHighSeverity = false;
  let hasModerateSeverity = false;

  for (const cat of categories) {
    const prescribed = (params.prescribedRoutine as any)[cat.key] || [];
    const actual = (params.actualSteps as any)[cat.key] || [];
    const prescribedNorm = prescribed.map((s: string) => s.trim().toLowerCase());
    const actualNorm = actual.map((s: string) => s.trim().toLowerCase());

    const reason = params.clinicianReasons?.[cat.key];

    const omitted = prescribed.filter((p: string) => !actualNorm.includes(p.trim().toLowerCase()));
    const added = actual.filter((a: string) => !prescribedNorm.includes(a.trim().toLowerCase()));

    if (omitted.length > 0 && added.length === 0) {
      const isCriticalCat = ['fillApply', 'compression', 'cover'].includes(cat.key);
      const severity: VarianceSeverity = isCriticalCat ? 'high_clinical_divergence' : 'moderate';
      if (severity === 'high_clinical_divergence') hasHighSeverity = true;
      else hasModerateSeverity = true;

      variances.push({
        stepCategory: cat.key,
        stepLabel: cat.label,
        prescribed,
        actual,
        varianceType: 'omission',
        reasonCode: reason?.code || 'supply_unavailable',
        reasonExplanation: reason?.explanation || `Prescribed ${cat.label} step(s) omitted during bedside encounter: ${omitted.join(', ')}`,
        varianceSeverity: severity,
      });
    } else if (omitted.length > 0 && added.length > 0) {
      const severity: VarianceSeverity = cat.key === 'compression' ? 'high_clinical_divergence' : 'moderate';
      if (severity === 'high_clinical_divergence') hasHighSeverity = true;
      else hasModerateSeverity = true;

      variances.push({
        stepCategory: cat.key,
        stepLabel: cat.label,
        prescribed,
        actual,
        varianceType: 'substitution',
        reasonCode: reason?.code || 'clinical_contraindication',
        reasonExplanation: reason?.explanation || `Bedside substitution for ${cat.label}: replaced [${omitted.join(', ')}] with [${added.join(', ')}]`,
        varianceSeverity: severity,
      });
    } else if (omitted.length === 0 && added.length > 0) {
      hasModerateSeverity = true;
      variances.push({
        stepCategory: cat.key,
        stepLabel: cat.label,
        prescribed,
        actual,
        varianceType: 'addition',
        reasonCode: reason?.code || 'wound_bed_deteriorated',
        reasonExplanation: reason?.explanation || `Additional bedside intervention added to ${cat.label}: ${added.join(', ')}`,
        varianceSeverity: 'low',
      });
    }
  }

  const prescribedFreq = params.prescribedRoutine.frequency;
  const actualFreq = params.actualSteps.frequency;
  if (prescribedFreq && actualFreq && prescribedFreq.trim().toLowerCase() !== actualFreq.trim().toLowerCase()) {
    hasModerateSeverity = true;
    const reason = params.clinicianReasons?.['frequency'];
    variances.push({
      stepCategory: 'frequency',
      stepLabel: 'Dressing Frequency',
      prescribed: [prescribedFreq],
      actual: [actualFreq],
      varianceType: 'frequency_change',
      reasonCode: reason?.code || 'provider_verbal_order',
      reasonExplanation: reason?.explanation || `Dressing frequency adjusted from "${prescribedFreq}" to "${actualFreq}"`,
      varianceSeverity: 'moderate',
    });
  }

  const overallStatus = hasHighSeverity
    ? 'significant_variance'
    : variances.length > 0
    ? 'minor_variance'
    : 'fully_concordant';

  return { variances, overallStatus };
}

export function recommendJadeAlgorithm(
  input: MobileWoundGuidanceInput | null | undefined,
  abpi?: number | null,
  availableAlgorithms: JadeCareAlgorithm[] = BUILT_IN_JADE_ALGORITHMS
): {
  recommendedAlgorithm: JadeCareAlgorithm | null;
  alternatives: JadeCareAlgorithm[];
  matchedCriteria: string[];
  clinicalCautions: string[];
  contraindications: string[];
} {
  if (!input) {
    return {
      recommendedAlgorithm: availableAlgorithms[0] || null,
      alternatives: availableAlgorithms.slice(1),
      matchedCriteria: ['No specific assessment provided; showing default care protocol.'],
      clinicalCautions: ['Perform formal wound assessment before initiating therapy.'],
      contraindications: [],
    };
  }

  const type = String(input.woundType || '').toLowerCase();
  const exudate = String(input.exudateAmount || '').toLowerCase();
  const necrotic = input.sloughPresent === true || input.escharPresent === true;
  const wet = exudate === 'moderate' || exudate === 'heavy';
  const dry = exudate === 'none' || exudate === 'light';

  const matchedCriteria: string[] = [];
  const clinicalCautions: string[] = [];
  const contraindications: string[] = [];

  if (abpi !== null && abpi !== undefined) {
    if (abpi < 0.5) {
      contraindications.push('ABPI < 0.5 indicates critical limb ischemia. STRICT CONTRAINDICATION TO COMPRESSION AND SHARP DEBRIDEMENT.');
      clinicalCautions.push('Urgent vascular surgical referral mandated.');
    } else if (abpi < 0.8) {
      contraindications.push('ABPI < 0.8 indicates arterial insufficiency. Standard high-compression bandages contraindicated.');
      clinicalCautions.push('Use protective, non-compressive or reduced modified (<20 mmHg) compression only.');
    } else if (abpi > 1.3) {
      clinicalCautions.push('ABPI > 1.3 indicates calcified incompressible vessels (common in diabetes/CKD). ABPI may be falsely normal/elevated; verify with TBI.');
    }
  }

  let targetCategory = 'wet';

  if (type.includes('arterial') || type.includes('ischemic') || type.includes('neuropathic') || (abpi !== null && abpi !== undefined && abpi < 0.8)) {
    targetCategory = 'arterial_neuropathic';
    matchedCriteria.push('Arterial/ischemic etiology detected');
  } else if (type.includes('venous') || type.includes('stasis')) {
    targetCategory = 'venous';
    matchedCriteria.push('Venous etiology detected');
    if (abpi !== null && abpi !== undefined && abpi < 0.8) {
      clinicalCautions.push('Mixed arterial-venous disease: standard venous compression is contraindicated.');
    }
  } else if (type.includes('pressure') || type.includes('decubitus') || type.includes('sacral')) {
    targetCategory = 'pressure_injury';
    matchedCriteria.push('Pressure injury etiology detected');
  } else if (necrotic && wet) {
    targetCategory = 'wet_necrotic';
    matchedCriteria.push('Necrotic devitalized slough/eschar with moderate/heavy moisture');
  } else if (necrotic && dry) {
    targetCategory = 'arterial_neuropathic';
    matchedCriteria.push('Dry necrotic eschar requiring protective management');
  } else if (wet) {
    targetCategory = 'venous';
    matchedCriteria.push('Exudative wound bed requiring moisture balance');
  } else {
    targetCategory = 'pressure_injury';
    matchedCriteria.push('Standard wound bed proliferation protocol');
  }

  const match = availableAlgorithms.find(a => a.category === targetCategory && a.active);
  const alternatives = availableAlgorithms.filter(a => a.id !== match?.id && a.active);

  if (match) {
    clinicalCautions.push(...match.safetyCautions);
  }

  return {
    recommendedAlgorithm: match || availableAlgorithms[0] || null,
    alternatives,
    matchedCriteria,
    clinicalCautions,
    contraindications,
  };
}
