/**
 * Patient and caregiver education, as this product already models it.
 *
 * The four structured fields -- who was taught, how ready they were, how it
 * was delivered, how they responded -- are copied verbatim from the web
 * app's models/education-record.model.ts. The mobile app writes into the same
 * patients/{id}/educationRecords documents that app reads, so a teaching
 * session recorded in the home has to mean exactly what one recorded at the
 * desk means.
 *
 * The TOPICS are not here. They come from
 * organizations/{orgId}/educationTopicCatalog, authored by an administrator
 * (Admin -> Education topic catalog), because what an organization teaches is
 * its own decision. Typing a topic not yet in the catalog still works -- it is
 * just not proposed -- which is the same escape hatch the web offers.
 */

export type EducationLearner =
  | 'patient'
  | 'family'
  | 'significant_other'
  | 'caregiver'
  | 'mother'
  | 'father'
  | 'guardian'
  | 'foster_parent'
  | 'other';

export const EDUCATION_LEARNERS: Array<{ value: EducationLearner; label: string }> = [
  { value: 'patient', label: 'Patient' },
  { value: 'family', label: 'Family' },
  { value: 'significant_other', label: 'Significant Other' },
  { value: 'caregiver', label: 'Caregiver' },
  { value: 'mother', label: 'Mother' },
  { value: 'father', label: 'Father' },
  { value: 'guardian', label: 'Guardian' },
  { value: 'foster_parent', label: 'Foster Parent' },
  { value: 'other', label: 'Other' },
];

export type EducationReadiness = 'eager' | 'acceptance' | 'nonacceptance' | 'refuses';

export const EDUCATION_READINESS: Array<{ value: EducationReadiness; label: string }> = [
  { value: 'eager', label: 'Eager' },
  { value: 'acceptance', label: 'Acceptance' },
  { value: 'nonacceptance', label: 'Nonacceptance' },
  { value: 'refuses', label: 'Refuses' },
];

export type EducationMethod =
  | 'explanation'
  | 'demonstration'
  | 'handout'
  | 'interpreter'
  | 'video'
  | 'class_group';

export const EDUCATION_METHODS: Array<{ value: EducationMethod; label: string }> = [
  { value: 'explanation', label: 'Explanation' },
  { value: 'demonstration', label: 'Demonstration' },
  { value: 'handout', label: 'Handout' },
  { value: 'interpreter', label: 'Interpreter' },
  { value: 'video', label: 'Video' },
  { value: 'class_group', label: 'Class/Group' },
];

export type EducationResponse =
  | 'verbalizes_understanding'
  | 'demonstrated_understanding'
  | 'needs_reinforcement'
  | 'no_evidence_of_learning'
  | 'indicates_understanding_in_bedside'
  | 'indicates_has_questions_in_bedside'
  | 'refused_teaching';

export const EDUCATION_RESPONSES: Array<{ value: EducationResponse; label: string }> = [
  { value: 'verbalizes_understanding', label: 'Verbalizes Understanding' },
  { value: 'demonstrated_understanding', label: 'Demonstrated Understanding' },
  { value: 'needs_reinforcement', label: 'Needs Reinforcement' },
  { value: 'no_evidence_of_learning', label: 'No Evidence of Learning' },
  { value: 'indicates_understanding_in_bedside', label: 'Indicates Understanding in Bedside' },
  { value: 'indicates_has_questions_in_bedside', label: 'Indicates Has Questions in Bedside' },
  { value: 'refused_teaching', label: 'Refused Teaching' },
];

/** One admin-authored topic from the org's catalog. */
export interface EducationTopicOption {
  id: string;
  category: string;
  topic: string;
  /** Org-authored guidance on what to actually teach. Shown when selected. */
  instructionText: string | null;
}

export interface EducationDraft {
  topic: string;
  category: string | null;
  learners: EducationLearner[];
  readiness: EducationReadiness | null;
  method: EducationMethod[];
  response: EducationResponse[];
  woundId: string | null;
  notes: string | null;
}

/**
 * What is still missing before this is a teaching event rather than a topic
 * name, in the nurse's words.
 *
 * A topic and a learner are the two that make it one: "wound care was
 * explained" with nobody named is not documentation of anything. Readiness
 * and method are expected but not enforced, matching how the web marks them
 * -- this is captured at a bedside, and a half-recorded session is worth more
 * than an abandoned one.
 *
 * 'refuses' is a complete, valid record on its own. A patient who refuses
 * teaching has been taught nothing, and recording that honestly is the point
 * -- so no response or method is required with it, and the form must not
 * push a nurse into claiming one.
 */
export function educationGaps(draft: EducationDraft): string[] {
  const gaps: string[] = [];
  if (!draft.topic.trim()) gaps.push('Topic');
  if (!draft.learners.length) gaps.push('Who was taught');
  if (draft.readiness !== 'refuses') {
    if (!draft.readiness) gaps.push('Readiness');
    if (!draft.method.length) gaps.push('How it was delivered');
  }
  return gaps;
}

/** The minimum this app will store: something taught, to somebody. */
export function educationIsRecordable(draft: EducationDraft): boolean {
  return !!draft.topic.trim() && draft.learners.length > 0;
}
