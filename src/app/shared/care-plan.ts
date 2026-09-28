/**
 * Care plan vocabulary, copied from the web app's models/care-plan.model.ts.
 *
 * The ten problem categories are the product owner's own list, recorded there
 * verbatim; the goal and intervention WORDING is not in either repo -- it
 * lives in each organization's own catalog
 * (organizations/{orgId}/carePlanCatalog), authored by an admin. This app
 * reads that catalog rather than shipping clinical text of its own, which is
 * the same rule the web editor follows.
 */

export type CarePlanProblemCategory =
  | 'infection'
  | 'knowledge_deficit'
  | 'fall_prevention'
  | 'potential_for_compromised_skin_integrity'
  | 'nutrition'
  | 'urinary_status'
  | 'bowel_movement'
  | 'readiness_to_learn'
  | 'discharge_planning'
  | 'delirium';

export const CARE_PLAN_PROBLEM_CATEGORIES: Array<{ value: CarePlanProblemCategory; label: string }> = [
  { value: 'infection', label: 'Infection' },
  { value: 'knowledge_deficit', label: 'Knowledge deficit' },
  { value: 'fall_prevention', label: 'Fall prevention' },
  { value: 'potential_for_compromised_skin_integrity', label: 'Potential for compromised skin integrity' },
  { value: 'nutrition', label: 'Nutrition' },
  { value: 'urinary_status', label: 'Urinary status' },
  { value: 'bowel_movement', label: 'Bowel movement' },
  { value: 'readiness_to_learn', label: 'Patient/family readiness to learn' },
  { value: 'discharge_planning', label: 'Discharge planning' },
  { value: 'delirium', label: 'Delirium' },
];

export function carePlanCategoryLabel(category: string | null | undefined): string {
  return CARE_PLAN_PROBLEM_CATEGORIES.find((c) => c.value === category)?.label ?? '';
}

/** One admin-authored goal or intervention from the org's catalog. */
export interface CarePlanCatalogEntry {
  id: string;
  category: string;
  kind: string;
  text: string;
}

/** `yyyy-mm-dd` in the device's own timezone, which is the visit's timezone. */
export function todayIsoDate(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Splits a textarea into one goal per line.
 *
 * Same rule the web's care plan editor uses for its "Custom goals (one per
 * line)" field, so a plan written here and a plan written there produce the
 * same list rather than one blob.
 */
export function splitLines(value: string | null | undefined): string[] {
  return (value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => !!line);
}
