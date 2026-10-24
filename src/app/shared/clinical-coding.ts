/**
 * Wound-level diagnosis and procedure coding, written on the clinical record.
 *
 * SHARED SCHEMA -- this file is kept identical in JADE-SHOP
 * (src/app/models/clinical-coding.ts) and WoundAPP
 * (src/app/shared/clinical-coding.ts). Both apps write `clinicalCoding` on
 * patients/{id}/woundAssessments and patients/{id}/providerNotes; the claim
 * engine reads it from there. Change both copies together.
 *
 * What it is: what the documenting clinician recorded -- the ICD-10-CM codes
 * they assessed and the CPT/HCPCS services they performed, each tied to a
 * wound (or to the visit, for E/M). What it is not: a billing decision.
 * Coding review and claim authorization happen on the claim; this record is
 * frozen once the note or assessment is signed and is corrected only by a
 * signed amendment.
 *
 * CPT descriptions are never shipped here. PHWC has no licensed AMA file, so a
 * CPT code is entered by number with `codeSource: 'manual'`; its description
 * is whatever the clinician typed, and the claim warns that it is unverified.
 */

export const CLINICAL_CODING_SCHEMA_VERSION = 1;

/** Where a code value came from. Manual entry is valid; it is not verified. */
export type ClinicalCodeSource =
  | 'manual'
  | 'cdc_icd10cm'
  | 'cms_hcpcs'
  | 'licensed_catalog'
  | 'chart_diagnosis'
  | 'verified_external';

/**
 * proposed: recorded by the documenting clinician (an RN may propose).
 * provider_confirmed: a provider stated it in their own signed documentation.
 * rejected: kept for the audit trail, never billed.
 */
export type ClinicalCodeStatus = 'proposed' | 'provider_confirmed' | 'rejected';

export interface ClinicalCodingActor {
  uid: string;
  displayName: string | null;
  role?: string | null;
  credentials?: string | null;
}

export interface ClinicalDiagnosisCode {
  id: string;
  codeSystem: 'ICD-10-CM';
  code: string;
  description: string | null;
  /** The wound this diagnosis is about; null for a patient-level diagnosis. */
  woundId: string | null;
  codeSource: ClinicalCodeSource;
  /** patients/{id}/diagnostic record this reuses, when picked from the chart. */
  chartDiagnosisId?: string | null;
  status: ClinicalCodeStatus;
  recordedBy: ClinicalCodingActor | null;
  recordedAtIso: string | null;
}

export type ClinicalProcedureScope = 'wound' | 'visit';

export interface ClinicalProcedureCode {
  id: string;
  codeSystem: 'CPT' | 'HCPCS';
  code: string;
  description: string | null;
  /** E/M and other encounter services are 'visit'; debridement is 'wound'. */
  scope: ClinicalProcedureScope;
  woundId: string | null;
  /** YYYY-MM-DD the service was performed. */
  procedureDate: string | null;
  procedureType: string | null;
  units: number;
  /** ClinicalDiagnosisCode ids this service addresses. */
  diagnosisIds: string[];
  /** ProviderDebridementProcedure.procedureId holding the procedure facts. */
  debridementProcedureId?: string | null;
  renderingProviderUid: string | null;
  codeSource: ClinicalCodeSource;
  status: ClinicalCodeStatus;
  recordedBy: ClinicalCodingActor | null;
  recordedAtIso: string | null;
}

export interface ClinicalCoding {
  schemaVersion: number;
  visitId: string | null;
  diagnoses: ClinicalDiagnosisCode[];
  procedures: ClinicalProcedureCode[];
}

export interface ClinicalCodingIssue {
  level: 'error' | 'warning';
  field: string;
  message: string;
}

const ICD10CM_FORMAT = /^[A-TV-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?$/;
/** Category I (5 digits), II (4 digits + F), III (4 digits + T), PLA (4 digits + U). */
const CPT_FORMAT = /^[0-9]{4}[0-9FTU]$/;
const HCPCS_LEVEL_II_FORMAT = /^[A-V][0-9]{4}$/;
const DEBRIDEMENT_CODES = new Set(['97597', '97598', '11042', '11043', '11044', '11045', '11046', '11047']);
const DEBRIDEMENT_ADD_ON_CODES = new Set(['97598', '11045', '11046', '11047']);
const DEBRIDEMENT_UNIT_SQ_CM = 20;

export function normalizeClinicalCode(value: unknown): string {
  return String(value ?? '').trim().toUpperCase().replace(/\s+/g, '');
}

export function isIcd10CmFormat(code: unknown): boolean {
  return ICD10CM_FORMAT.test(normalizeClinicalCode(code));
}

/** CPT, HCPCS Level II, or null when the value is neither format. */
export function procedureCodeSystem(code: unknown): 'CPT' | 'HCPCS' | null {
  const value = normalizeClinicalCode(code);
  if (CPT_FORMAT.test(value)) return 'CPT';
  if (HCPCS_LEVEL_II_FORMAT.test(value)) return 'HCPCS';
  return null;
}

/** Office/home E/M services (99202-99499) belong to the visit, never a wound. */
export function isEvaluationAndManagementCode(code: unknown): boolean {
  const value = normalizeClinicalCode(code);
  return /^99[2-4][0-9]{2}$/.test(value);
}

export function isDebridementCode(code: unknown): boolean {
  return DEBRIDEMENT_CODES.has(normalizeClinicalCode(code));
}

/**
 * Units the documented debrided area supports for a debridement code, for the
 * provider to review -- never applied silently. Base codes cover the first
 * 20 sq cm (1 unit); add-on codes cover each additional 20 sq cm or part.
 * Returns null when the area is not documented.
 */
export function suggestedDebridementUnits(code: unknown, areaDebridedCm2: unknown): number | null {
  const value = normalizeClinicalCode(code);
  const area = Number(areaDebridedCm2);
  if (!isDebridementCode(value) || !Number.isFinite(area) || area <= 0) return null;
  if (!DEBRIDEMENT_ADD_ON_CODES.has(value)) return 1;
  return Math.max(0, Math.ceil(area / DEBRIDEMENT_UNIT_SQ_CM) - 1);
}

export function emptyClinicalCoding(visitId: string | null = null): ClinicalCoding {
  return { schemaVersion: CLINICAL_CODING_SCHEMA_VERSION, visitId, diagnoses: [], procedures: [] };
}

/** Reads `clinicalCoding` from any record, tolerating legacy/absent data. */
export function clinicalCodingOf(record: unknown): ClinicalCoding | null {
  const coding = (record as any)?.clinicalCoding;
  if (!coding || typeof coding !== 'object') return null;
  return {
    schemaVersion: Number(coding.schemaVersion) || CLINICAL_CODING_SCHEMA_VERSION,
    visitId: typeof coding.visitId === 'string' && coding.visitId ? coding.visitId : null,
    diagnoses: Array.isArray(coding.diagnoses) ? coding.diagnoses.filter((row: any) => row && row.code) : [],
    procedures: Array.isArray(coding.procedures) ? coding.procedures.filter((row: any) => row && row.code) : [],
  };
}

/**
 * Checks a coding block before it is saved or signed.
 *
 * Errors stop signing; warnings are shown and kept. A manually entered CPT is
 * a warning (unverified), never an error: PHWC enters CPT by number.
 * `woundIds` are the wounds this document covers; a wound-level row must name
 * one of them.
 */
export function validateClinicalCoding(
  coding: ClinicalCoding | null | undefined,
  options: { woundIds?: string[]; debridementProcedureIds?: string[]; requireProvider?: boolean } = {}
): ClinicalCodingIssue[] {
  const issues: ClinicalCodingIssue[] = [];
  if (!coding) return issues;
  const wounds = new Set((options.woundIds ?? []).filter(Boolean));
  const diagnosisIds = new Set<string>();
  const seenDiagnoses = new Set<string>();

  coding.diagnoses.forEach((row, index) => {
    const label = `Diagnosis ${index + 1}`;
    const code = normalizeClinicalCode(row.code);
    diagnosisIds.add(row.id);
    if (row.status === 'rejected') return;
    if (!isIcd10CmFormat(code)) {
      issues.push({ level: 'error', field: `diagnoses.${index}.code`, message: `${label}: "${row.code}" is not an ICD-10-CM code format (for example L89.153).` });
    }
    const key = `${code}|${row.woundId ?? ''}`;
    if (seenDiagnoses.has(key)) {
      issues.push({ level: 'error', field: `diagnoses.${index}.code`, message: `${label}: ${code} is already recorded${row.woundId ? ' for this wound' : ''}.` });
    }
    seenDiagnoses.add(key);
    if (row.woundId && wounds.size && !wounds.has(row.woundId)) {
      issues.push({ level: 'error', field: `diagnoses.${index}.woundId`, message: `${label}: the selected wound is not part of this documentation.` });
    }
    if (row.codeSource === 'manual') {
      issues.push({ level: 'warning', field: `diagnoses.${index}.code`, message: `${label}: ${code} was entered manually; coding review will verify it against the ICD-10-CM release for the date of service.` });
    }
  });

  const seenProcedures = new Set<string>();
  coding.procedures.forEach((row, index) => {
    const label = `Procedure ${index + 1}`;
    const code = normalizeClinicalCode(row.code);
    if (row.status === 'rejected') return;
    const system = procedureCodeSystem(code);
    if (!system) {
      issues.push({ level: 'error', field: `procedures.${index}.code`, message: `${label}: "${row.code}" is not a CPT (5 characters, e.g. 11042) or HCPCS Level II (e.g. G0463) code format.` });
    }
    if (isEvaluationAndManagementCode(code) && row.scope !== 'visit') {
      issues.push({ level: 'error', field: `procedures.${index}.scope`, message: `${label}: ${code} is an evaluation and management service; record it once for the visit, not for a wound.` });
    }
    if (row.scope === 'wound' && !row.woundId) {
      issues.push({ level: 'error', field: `procedures.${index}.woundId`, message: `${label}: choose the wound this procedure was performed on.` });
    }
    if (row.woundId && wounds.size && !wounds.has(row.woundId)) {
      issues.push({ level: 'error', field: `procedures.${index}.woundId`, message: `${label}: the selected wound is not part of this documentation.` });
    }
    if (isDebridementCode(code) && row.scope !== 'wound') {
      issues.push({ level: 'error', field: `procedures.${index}.scope`, message: `${label}: debridement ${code} is performed on a wound; choose the wound.` });
    }
    if (isDebridementCode(code) && options.debridementProcedureIds &&
        (!row.debridementProcedureId || !options.debridementProcedureIds.includes(row.debridementProcedureId))) {
      issues.push({ level: 'error', field: `procedures.${index}.debridementProcedureId`, message: `${label}: link ${code} to the documented debridement (tissue removed, depth, area) it bills.` });
    }
    if (!Number.isInteger(Number(row.units)) || Number(row.units) < 1) {
      issues.push({ level: 'error', field: `procedures.${index}.units`, message: `${label}: units must be a whole number of 1 or more.` });
    }
    for (const id of row.diagnosisIds ?? []) {
      if (!diagnosisIds.has(id)) {
        issues.push({ level: 'error', field: `procedures.${index}.diagnosisIds`, message: `${label}: it points to a diagnosis that is no longer listed.` });
        break;
      }
    }
    const key = `${code}|${row.woundId ?? ''}|${row.procedureDate ?? ''}`;
    if (seenProcedures.has(key)) {
      issues.push({ level: 'error', field: `procedures.${index}.code`, message: `${label}: ${code} is already recorded${row.woundId ? ' for this wound' : ' for this visit'} on this date.` });
    }
    seenProcedures.add(key);
    if (system === 'CPT' && row.codeSource !== 'licensed_catalog' && row.codeSource !== 'verified_external') {
      issues.push({ level: 'warning', field: `procedures.${index}.code`, message: `${label}: CPT ${code} was entered by number and is unverified until coding review.` });
    }
  });

  return issues;
}

export function clinicalCodingBlockingIssues(issues: ClinicalCodingIssue[]): string[] {
  return issues.filter((issue) => issue.level === 'error').map((issue) => issue.message);
}
