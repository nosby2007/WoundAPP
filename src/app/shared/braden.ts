/**
 * The Braden Scale, as this product already implements it.
 *
 * Scoring and thresholds are a verbatim port of the web app's
 * src/app/shared/braden-scoring.util.ts; the six subscale option lists are a
 * verbatim copy of add-assessment-dialog.component.ts. Neither is authored
 * here. The mobile app writes into the same `patients/{id}/assessments`
 * documents the web app's Braden list reads, so a score taken in the home has
 * to mean exactly what a score taken at the desk means.
 *
 * Note the deliberate asymmetry in the subscales: friction/shear has three
 * options, the other five have four. That is the scale, not an omission --
 * the total runs 6 to 23, which is why 23 is "minimal / no risk" and not 24.
 */

export interface BradenSubscaleOption {
  value: number;
  label: string;
}

export const BRADEN_SENSORY: BradenSubscaleOption[] = [
  { value: 1, label: '1: Completely limited' },
  { value: 2, label: '2: Very limited' },
  { value: 3, label: '3: Slightly limited' },
  { value: 4, label: '4: No limitation' },
];

export const BRADEN_MOISTURE: BradenSubscaleOption[] = [
  { value: 1, label: '1: Constantly moist' },
  { value: 2, label: '2: Very moist' },
  { value: 3, label: '3: Occasionally moist' },
  { value: 4, label: '4: Rarely moist' },
];

export const BRADEN_ACTIVITY: BradenSubscaleOption[] = [
  { value: 1, label: '1: Bedfast' },
  { value: 2, label: '2: Chairfast' },
  { value: 3, label: '3: Walks occasionally' },
  { value: 4, label: '4: Walks frequently' },
];

export const BRADEN_MOBILITY: BradenSubscaleOption[] = [
  { value: 1, label: '1: Completely immobile' },
  { value: 2, label: '2: Very limited' },
  { value: 3, label: '3: Slightly limited' },
  { value: 4, label: '4: No limitation' },
];

export const BRADEN_NUTRITION: BradenSubscaleOption[] = [
  { value: 1, label: '1: Very poor' },
  { value: 2, label: '2: Probably inadequate' },
  { value: 3, label: '3: Adequate' },
  { value: 4, label: '4: Excellent' },
];

export const BRADEN_FRICTION: BradenSubscaleOption[] = [
  { value: 1, label: '1: Problem' },
  { value: 2, label: '2: Potential problem' },
  { value: 3, label: '3: No apparent problem' },
];

export interface BradenSubscales {
  sensory: number | null | undefined;
  moisture: number | null | undefined;
  activity: number | null | undefined;
  mobility: number | null | undefined;
  nutrition: number | null | undefined;
  friction: number | null | undefined;
}

export type BradenRiskClass = 'vh' | 'h' | 'm' | 'r' | 'n';

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function bradenTotal(subscales: BradenSubscales): number {
  return (
    toNum(subscales.sensory) +
    toNum(subscales.moisture) +
    toNum(subscales.activity) +
    toNum(subscales.mobility) +
    toNum(subscales.nutrition) +
    toNum(subscales.friction)
  );
}

export function bradenRiskText(total: number): string {
  if (total <= 9) return 'Very high risk';
  if (total <= 12) return 'High risk';
  if (total <= 14) return 'Moderate risk';
  if (total <= 18) return 'At risk';
  return 'Minimal / no risk';
}

export function bradenRiskClass(total: number): BradenRiskClass {
  if (total <= 9) return 'vh';
  if (total <= 12) return 'h';
  if (total <= 14) return 'm';
  if (total <= 18) return 'r';
  return 'n';
}

/** Every subscale answered. A partial Braden has no total worth reporting. */
export function bradenIsComplete(subscales: BradenSubscales): boolean {
  return [
    subscales.sensory, subscales.moisture, subscales.activity,
    subscales.mobility, subscales.nutrition, subscales.friction,
  ].every((value) => typeof value === 'number' && Number.isFinite(value));
}

/**
 * The `answers.braden` object the web app's Braden list reads.
 *
 * Field-for-field what add-assessment-dialog.component.ts writes for
 * `case 'braden'`: the six subscales, the date, the total and the risk text.
 * braden-list.component.ts recomputes the total from the subscales rather
 * than trusting the stored one, so a drift here would show up as a row whose
 * printed total disagrees with its own parts.
 */
export function buildBradenAnswers(
  subscales: BradenSubscales,
  assessedAt: Date,
): Record<string, unknown> {
  const total = bradenTotal(subscales);
  return {
    sensory: subscales.sensory,
    moisture: subscales.moisture,
    activity: subscales.activity,
    mobility: subscales.mobility,
    nutrition: subscales.nutrition,
    friction: subscales.friction,
    date: assessedAt,
    total,
    riskText: bradenRiskText(total),
  };
}

/* --- Actions ------------------------------------------------------------
 * What to do about an answer. The wording is admin-authored and read from
 * organizations/{orgId}/bradenInterventionCatalog -- see
 * services/braden-intervention.service.ts. Only the shaping is here. */

export type BradenSubscale =
  | 'sensory'
  | 'moisture'
  | 'activity'
  | 'mobility'
  | 'nutrition'
  | 'friction';

/** Display order and labels, matching the order the form asks them in. */
export const BRADEN_SUBSCALE_LABELS: Array<{ value: BradenSubscale; label: string }> = [
  { value: 'sensory', label: 'Sensory perception' },
  { value: 'moisture', label: 'Moisture' },
  { value: 'activity', label: 'Activity' },
  { value: 'mobility', label: 'Mobility' },
  { value: 'nutrition', label: 'Nutrition' },
  { value: 'friction', label: 'Friction & shear' },
];

export interface BradenActionGroup {
  subscale: BradenSubscale;
  label: string;
  score: number;
  /** Empty when the organization has authored nothing for this answer. */
  actions: string[];
}

/**
 * The action list to show under the score.
 *
 * ONLY FOR SUBSCALES THAT HAVE AN ANSWER. An unanswered subscale has no
 * score, so there is nothing it could be showing actions for -- listing it
 * with an empty body would read as "nothing to do here", which is a
 * different and false statement.
 *
 * A group with no actions is still returned when the subscale IS answered:
 * the screen says the organization has not written any for that answer,
 * which is the truth and is actionable (an admin can add them). Dropping it
 * silently would leave the nurse thinking the score needs nothing.
 */
export function bradenActionGroups(
  subscales: BradenSubscales,
  catalog: Array<{ subscale: string; score: number; text: string }>,
): BradenActionGroup[] {
  const answers: Record<BradenSubscale, number | null | undefined> = {
    sensory: subscales.sensory,
    moisture: subscales.moisture,
    activity: subscales.activity,
    mobility: subscales.mobility,
    nutrition: subscales.nutrition,
    friction: subscales.friction,
  };

  const groups: BradenActionGroup[] = [];
  for (const { value, label } of BRADEN_SUBSCALE_LABELS) {
    const score = answers[value];
    if (typeof score !== 'number' || !Number.isFinite(score)) continue;

    groups.push({
      subscale: value,
      label,
      score,
      actions: catalog
        .filter((item) => item.subscale === value && Number(item.score) === score)
        .map((item) => (item.text ?? '').trim())
        .filter((text) => !!text),
    });
  }
  return groups;
}
