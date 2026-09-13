export interface MobileWoundGuidanceInput {
  woundType?: string | null;
  exudateAmount?: string | null;
  sloughPresent?: boolean | null;
  escharPresent?: boolean | null;
  infectionFindings?: string[];
  infectionStatus?: string | null;
}

export interface MobileAlgorithmGuidance {
  suggestedTypes: string[];
  rationale: string[];
  cautions: string[];
}

export function deriveMobileAlgorithmGuidance(
  input: MobileWoundGuidanceInput | null | undefined
): MobileAlgorithmGuidance {
  if (!input) {
    return {
      suggestedTypes: [],
      rationale: [],
      cautions: ['No wound assessment is available to guide protocol filtering.'],
    };
  }

  const type = String(input.woundType || '').toLowerCase();
  const exudate = String(input.exudateAmount || '').toLowerCase();
  const necrotic = input.sloughPresent === true || input.escharPresent === true;
  const wet = exudate === 'moderate' || exudate === 'heavy';
  const dry = exudate === 'none' || exudate === 'light';

  const suggested = new Set<string>();
  const rationale: string[] = [];
  const cautions: string[] = [];

  if (type.includes('venous')) {
    suggested.add('venous');
    rationale.push('Documented wound type is venous.');
  }
  if (type.includes('arterial') || type.includes('neuropathic') || type.includes('ischemic')) {
    suggested.add('arterial_neuropathic');
    rationale.push('Documented wound type is arterial, ischemic, or neuropathic.');
  }
  if (type.includes('skin tear')) {
    suggested.add('skin_tear');
    rationale.push('Documented wound type is skin tear.');
  }
  if (type.includes('surgical')) {
    suggested.add('surgical');
    rationale.push('Documented wound type is surgical.');
  }

  if (necrotic && wet) {
    suggested.add('wet_necrotic');
    rationale.push('Necrotic tissue is documented with moderate/heavy exudate.');
  } else if (necrotic && dry) {
    suggested.add('dry_necrotic');
    rationale.push('Necrotic tissue is documented with none/light exudate.');
  } else if (!necrotic && wet) {
    suggested.add('wet');
    rationale.push('Moderate/heavy exudate is documented without necrotic tissue.');
  } else if (!necrotic && dry) {
    suggested.add('dry');
    rationale.push('None/light exudate is documented without necrotic tissue.');
  }

  const findings = input.infectionFindings || [];
  if (
    findings.some(finding => finding && finding !== 'None') ||
    input.infectionStatus === 'Suspected' ||
    input.infectionStatus === 'MD/Provider diagnosed infection'
  ) {
    cautions.push('Infection findings are documented. Provider review is required.');
  }

  cautions.push('Compression and NPWT are never auto-suggested by mobile guidance.');

  return {
    suggestedTypes: [...suggested],
    rationale,
    cautions,
  };
}
