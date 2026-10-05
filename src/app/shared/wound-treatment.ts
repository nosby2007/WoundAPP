/**
 * The treatment section of a wound assessment.
 *
 * `WoundAssessment.treatment` has always been part of the document this app
 * writes -- the web app renders it in full, and the Medicare audit packet
 * prints it -- but the mobile form never asked, so the section came out
 * empty on every assessment taken in the field.
 *
 * Kept out of the component so the one rule with any judgement in it can be
 * tested directly: what gets written when the nurse fills in some of it,
 * none of it, or clears what was there before.
 */

export interface WoundTreatmentFormValue {
  dressingAppearance?: string | null;
  cleansing?: string | null;
  debridement?: string | null;
  primary?: string | null;
  primaryOther?: string | null;
  secondary?: string | null;
  secondaryOther?: string | null;
  modalities?: string | null;
  additionalCare?: string[] | null;
}

/**
 * Returns the treatment to store, or null when nothing was recorded.
 *
 * NULL IS NOT THE SAME AS AN EMPTY SECTION.
 * The web form opens on 'Normal Saline' / 'Foam' / 'Film/Membrane'. Those
 * defaults are harmless at a desk where the section is always reviewed;
 * writing them from a phone would put a dressing nobody applied into the
 * chart of a nurse who scrolled past. So every control here starts blank and
 * an untouched section produces null -- which the caller writes as an absent
 * key on create, and as an explicit null on update, because leaving a key off
 * an update() is a no-op in Firestore and the old dressing would otherwise
 * survive its own deletion.
 *
 * `primaryOther`/`secondaryOther` are carried only while the matching
 * dressing is 'Other'. A stale "other" note sitting under a named dressing
 * reads as a second, contradictory dressing.
 */
export function buildWoundTreatment(
  value: WoundTreatmentFormValue,
): Record<string, unknown> | null {
  const additionalCare = (value.additionalCare || []).filter((entry) => !!entry);

  const chosen = [
    value.dressingAppearance,
    value.cleansing,
    value.debridement,
    value.primary,
    value.secondary,
    value.modalities,
  ].some((entry) => !!entry);

  if (!chosen && !additionalCare.length) return null;

  const treatment: Record<string, unknown> = { additionalCare };
  if (value.dressingAppearance) treatment['dressingAppearance'] = value.dressingAppearance;
  if (value.cleansing) treatment['cleansing'] = value.cleansing;
  if (value.debridement) treatment['debridement'] = value.debridement;
  if (value.primary) treatment['primary'] = value.primary;
  if (value.primary === 'Other' && value.primaryOther) {
    treatment['primaryOther'] = value.primaryOther;
  }
  if (value.secondary) treatment['secondary'] = value.secondary;
  if (value.secondary === 'Other' && value.secondaryOther) {
    treatment['secondaryOther'] = value.secondaryOther;
  }
  if (value.modalities) treatment['modalities'] = value.modalities;
  return treatment;
}
