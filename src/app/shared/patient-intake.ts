/**
 * The field intake payload.
 *
 * The nurse arrives at the home with a phone, registers the patient, assesses
 * the wounds and leaves. That only works if the record this app creates is the
 * same record the web app's intake creates -- otherwise somebody re-keys it
 * later from a paper form, which is the thing the visit was supposed to avoid.
 *
 * So the shape here is the web app's own, taken from
 * patients/pages/patient-form/patient-form.component.ts: the four nested
 * groups (demographics / identity / clinical / consent) that its edit form
 * reads back, plus the flat aliases the rest of the web app displays from
 * (patient-demographic-card reads `address`/`address1`/`phone` directly, not
 * the nested group). The web writes both; so does this.
 *
 * NOTHING IS INVENTED HERE. Every field name, and the decision to write both
 * shapes, comes from that component. The one value this file computes on its
 * own is `address`, which the web sets to `address1` -- same rule, same line.
 *
 * BLANKS ARE OMITTED, NOT WRITTEN AS ''.
 * The web form writes `''` for every untouched control because it edits a
 * whole record at once. An intake done at the bedside is partial by nature:
 * the nurse has the address and the insurance card, or does not. An absent
 * key reads as "not collected"; a stored '' reads as "collected, empty". They
 * are different statements about the chart, and only the first one is true
 * here. The web's edit form is unaffected -- patchValue leaves a control at
 * its default when the key is missing, and every display path already uses
 * `||` fallbacks.
 *
 * Pure and framework-free on purpose: no Angular, no Firebase, no clock. It
 * takes a form value and returns an object, so it can be tested directly.
 */

/** Ticked consent boxes, as three separate acknowledgements. */
export interface PatientIntakeConsent {
  hipaaAck: boolean;
  privacyNoticeAck: boolean;
  financialAgreementAck: boolean;
}

export interface PatientIntakeFormValue {
  // Demographics
  legalName: string;
  preferredName?: string | null;
  gender?: string | null;
  dob?: string | null;
  admissionDate?: string | null;
  phone?: string | null;
  email?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  language?: string | null;
  maritalStatus?: string | null;
  roomNumber?: string | null;
  unit?: string | null;

  // Identity / coverage
  ssn?: string | null;
  idType?: string | null;
  idNumber?: string | null;
  insuranceProvider?: string | null;
  insuranceId?: string | null;
  groupNumber?: string | null;
  payor?: string | null;
  policyHolder?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyRelation?: string | null;

  // Clinical
  reasonForAdmission?: string | null;
  primaryCareProvider?: string | null;
  referringProvider?: string | null;
  codeStatus?: string | null;
  preferredPharmacy?: string | null;
  heightCm?: string | number | null;
  weightKg?: string | number | null;
  allergies?: string[] | null;
  diagnoses?: string[] | null;

  // Consent
  hipaaAck?: boolean | null;
  privacyNoticeAck?: boolean | null;
  financialAgreementAck?: boolean | null;
}

export interface PatientIntakeTenant {
  orgId?: string | null;
  facilityId?: string | null;
}

/** Trimmed string, or null when there is nothing there. */
function text(value: unknown): string | null {
  if (typeof value === 'number') return String(value);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * A date the API can store. The web form sends an ISO string when it posts
 * through the API (`useApi`), so this does the same rather than shipping a
 * Date through JSON and hoping.
 *
 * An unparseable value returns null instead of `Invalid Date`: a date nobody
 * can read is worse in a chart than no date at all.
 */
export function toIsoDate(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** Non-empty, de-duplicated, order-preserving list; null when nothing is left. */
function list(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of value) {
    const item = text(entry);
    if (item && !seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out.length ? out : null;
}

/** Drops every key whose value is null or undefined, one level deep. */
function compact(source: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value !== null && value !== undefined) out[key] = value;
  }
  return out;
}

/**
 * Builds the POST /patients body for a field intake.
 *
 * `orgId` is included for parity with the existing form, but the API stamps
 * its own from the caller's token and strips any sent here
 * (sanitizeWritePayload in functions/src/tenant-scope.ts) -- so it is the
 * token that decides the tenant, not this payload. `facilityId` is not
 * stripped, and a home-based patient legitimately has none.
 *
 * The consent group is always written in full, all three booleans, even when
 * every box is unticked. That is deliberate and the one exception to omitting
 * blanks: "the nurse did not tick the HIPAA box" is a fact worth recording,
 * and an absent consent block would be indistinguishable from an intake done
 * before the app asked at all.
 */
export function buildPatientIntakePayload(
  value: PatientIntakeFormValue,
  tenant: PatientIntakeTenant = {},
): Record<string, unknown> {
  const demographics = compact({
    legalName: text(value.legalName),
    preferredName: text(value.preferredName),
    gender: text(value.gender),
    dob: toIsoDate(value.dob),
    admissionDate: toIsoDate(value.admissionDate),
    phone: text(value.phone),
    email: text(value.email),
    address1: text(value.address1),
    address2: text(value.address2),
    city: text(value.city),
    state: text(value.state),
    zip: text(value.zip),
    country: text(value.country),
    language: text(value.language),
    maritalStatus: text(value.maritalStatus),
    facilityId: text(tenant.facilityId),
    roomNumber: text(value.roomNumber),
    unit: text(value.unit),
  });

  const identity = compact({
    ssn: text(value.ssn),
    idType: text(value.idType),
    idNumber: text(value.idNumber),
    insuranceProvider: text(value.insuranceProvider),
    insuranceId: text(value.insuranceId),
    groupNumber: text(value.groupNumber),
    payor: text(value.payor),
    policyHolder: text(value.policyHolder),
    emergencyContactName: text(value.emergencyContactName),
    emergencyContactPhone: text(value.emergencyContactPhone),
    emergencyRelation: text(value.emergencyRelation),
  });

  const clinical = compact({
    reasonForAdmission: text(value.reasonForAdmission),
    primaryCareProvider: text(value.primaryCareProvider),
    referringProvider: text(value.referringProvider),
    codeStatus: text(value.codeStatus),
    preferredPharmacy: text(value.preferredPharmacy),
    heightCm: text(value.heightCm),
    weightKg: text(value.weightKg),
    allergies: list(value.allergies),
    diagnoses: list(value.diagnoses),
  });

  const consent: PatientIntakeConsent = {
    hipaaAck: value.hipaaAck === true,
    privacyNoticeAck: value.privacyNoticeAck === true,
    financialAgreementAck: value.financialAgreementAck === true,
  };

  // Flat aliases. `address` mirrors address1, as the web form does.
  const flat = compact({
    name: text(value.legalName),
    preferredName: text(value.preferredName),
    gender: text(value.gender),
    dob: toIsoDate(value.dob),
    admissionDate: toIsoDate(value.admissionDate),

    phone: text(value.phone),
    email: text(value.email),
    address: text(value.address1),
    address1: text(value.address1),
    address2: text(value.address2),
    city: text(value.city),
    state: text(value.state),
    zip: text(value.zip),
    country: text(value.country),
    language: text(value.language),
    maritalStatus: text(value.maritalStatus),
    roomNumber: text(value.roomNumber),
    unit: text(value.unit),

    ssn: text(value.ssn),
    idType: text(value.idType),
    idNumber: text(value.idNumber),
    insuranceProvider: text(value.insuranceProvider),
    insuranceId: text(value.insuranceId),
    groupNumber: text(value.groupNumber),
    payor: text(value.payor),
    policyHolder: text(value.policyHolder),
    emergencyContactName: text(value.emergencyContactName),
    emergencyContactPhone: text(value.emergencyContactPhone),
    emergencyRelation: text(value.emergencyRelation),

    reasonForAdmission: text(value.reasonForAdmission),
    primaryCareProvider: text(value.primaryCareProvider),
    referringProvider: text(value.referringProvider),
    codeStatus: text(value.codeStatus),
    preferredPharmacy: text(value.preferredPharmacy),
    heightCm: text(value.heightCm),
    weightKg: text(value.weightKg),
    allergies: list(value.allergies),
    diagnoses: list(value.diagnoses),

    hipaaAck: consent.hipaaAck,
    privacyNoticeAck: consent.privacyNoticeAck,
    financialAgreementAck: consent.financialAgreementAck,

    orgId: text(tenant.orgId),
    facilityId: text(tenant.facilityId),
  });

  const payload: Record<string, unknown> = {...flat, consent};
  if (Object.keys(demographics).length) payload['demographics'] = demographics;
  if (Object.keys(identity).length) payload['identity'] = identity;
  if (Object.keys(clinical).length) payload['clinical'] = clinical;

  return payload;
}

/**
 * What is still missing for this patient to be billable and locatable, in the
 * nurse's words. Shown as a reminder on the way out, never as a block: an
 * intake with only a name is still worth more than a visit with no record.
 *
 * The three chosen are the ones a later step actually fails without: an
 * address (a home visit's EVV location and the claim's service address), a
 * date of birth (every payer eligibility check keys on it), and a payer.
 */
export function intakeGaps(value: PatientIntakeFormValue): string[] {
  const gaps: string[] = [];
  if (!text(value.address1) || !text(value.city) || !text(value.state) || !text(value.zip)) {
    gaps.push('Home address');
  }
  if (!toIsoDate(value.dob)) gaps.push('Date of birth');
  if (!text(value.insuranceProvider) && !text(value.payor)) gaps.push('Insurance / payer');
  return gaps;
}
