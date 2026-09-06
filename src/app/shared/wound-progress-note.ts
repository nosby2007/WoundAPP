/**
 * The wound progress note, assembled from what the visit already recorded.
 *
 * The nurse has just measured every wound, chosen every dressing, scored the
 * Braden and taught the caregiver. Retyping all of that into a note is how
 * an hour of documentation gets added to a visit, and how the note ends up
 * disagreeing with the chart it was copied from.
 *
 * So the note is BUILT from the assessments rather than written beside them.
 * Two things are the clinician's own and are asked for: why the consult
 * happened, and what the recommendation is. Everything else is a rendering
 * of data already in the record.
 *
 * NO CLINICAL VOCABULARY IS AUTHORED HERE. Every wound value printed below
 * comes from this product's own wound assessment -- the same strings the web
 * app's form offers and its chart displays. The layout follows the template
 * the product owner supplied; the words in it are ours.
 *
 * Pure and framework-free on purpose: no Angular, no Firebase, no clock. It
 * takes a snapshot and returns text, so what it produces can be tested
 * exactly.
 */

export type WoundNoteVisitKind = 'admission' | 'follow_up';

/**
 * Why the consult happened, in the product owner's own words. An admission
 * visit and a weekly review are different services and read differently on a
 * claim, which is why this is a choice and not a constant.
 */
export const WOUND_NOTE_REASONS: Array<{ kind: WoundNoteVisitKind; text: string }> = [
  { kind: 'admission', text: 'Admission visit wound evaluation and treat' },
  { kind: 'follow_up', text: 'Weekly skin and wound evaluation' },
];

/**
 * What happens next. "Start" on a first visit, "continue" on a review --
 * saying "continue" on an admission claims a plan that did not exist yet.
 */
export const WOUND_NOTE_RECOMMENDATIONS: Array<{ kind: WoundNoteVisitKind; text: string }> = [
  { kind: 'admission', text: 'Start treatment and prevention plan of care' },
  { kind: 'follow_up', text: 'Continue treatment and prevention plan of care' },
];

export function defaultReasonForConsult(kind: WoundNoteVisitKind): string {
  return WOUND_NOTE_REASONS.find((r) => r.kind === kind)?.text ?? '';
}

export function defaultRecommendation(kind: WoundNoteVisitKind): string {
  return WOUND_NOTE_RECOMMENDATIONS.find((r) => r.kind === kind)?.text ?? '';
}

export interface WoundNotePatient {
  name: string;
  dob?: string | Date | null;
  gender?: string | null;
  diagnoses?: string[] | null;
  allergies?: string[] | null;
  pastMedicalHistory?: string | null;
  pastSurgicalHistory?: string | null;
}

export interface WoundNoteOrder {
  orderedAt: Date | null;
  orderType: string;
  description: string;
  orderedByName: string;
}

export interface WoundNoteWound {
  woundId: string;
  type: string;
  location: string;
  acquired?: string | null;
  stage?: string | null;
  firstAssessedAt: Date | null;
  assessedAt: Date | null;
  measurements: {
    length: number | null;
    width: number | null;
    depth: number | null;
    area: number | null;
    volume: number | null;
    undermining?: string | null;
    tunneling?: string | null;
  };
  woundBed?: {
    epithelial?: boolean;
    granulation?: { present?: boolean; percent?: number | null };
    slough?: { present?: boolean; percent?: number | null };
    eschar?: boolean;
    infection?: string[];
    other?: string[];
  } | null;
  exudate?: { amount?: string | null; type?: string | null; odor?: string | null } | null;
  periwound?: {
    edges?: string | null;
    surrounding?: string[];
    induration?: string | null;
    edema?: string | null;
    temperature?: string | null;
  } | null;
  pain?: { score?: number | null; frequency?: string | null } | null;
  progress?: { status?: string | null; infection?: string | null; notes?: string | null } | null;
  treatment?: {
    dressingAppearance?: string | null;
    cleansing?: string | null;
    debridement?: string | null;
    primary?: string | null;
    secondary?: string | null;
    modalities?: string | null;
    additionalCare?: string[];
  } | null;
  goalOfCare?: string | null;
  orders: WoundNoteOrder[];
}

export interface WoundNoteEducation {
  topic: string;
  learners: string[];
  response: string[];
}

export interface WoundNoteInput {
  visitKind: WoundNoteVisitKind;
  reasonForConsult: string;
  recommendation: string;
  patient: WoundNotePatient;
  bradenTotal: number | null;
  bradenRiskText: string | null;
  wounds: WoundNoteWound[];
  education: WoundNoteEducation[];
  recordedByName: string;
  recordedAt: Date;
}

/* ------------------------------------------------------------ formatting */

/** Whole years, or null when there is no usable date of birth. */
export function ageInYears(dob: string | Date | null | undefined, on: Date): number | null {
  if (!dob) return null;
  const born = dob instanceof Date ? dob : new Date(dob);
  if (Number.isNaN(born.getTime())) return null;

  let age = on.getFullYear() - born.getFullYear();
  const monthDelta = on.getMonth() - born.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && on.getDate() < born.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

function pad(value: number): string {
  return `${value}`.padStart(2, '0');
}

/** MM/DD/YY HHMM, the format the supplied template uses. */
export function noteDateTime(value: Date | null | undefined): string {
  if (!value || Number.isNaN(value.getTime())) return '';
  return `${pad(value.getMonth() + 1)}/${pad(value.getDate())}/${`${value.getFullYear()}`.slice(2)}` +
    ` ${pad(value.getHours())}${pad(value.getMinutes())}`;
}

function num(value: number | null | undefined, unit: string): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return `${value} ${unit}`;
}

function joinList(values: string[] | null | undefined): string {
  return (values ?? []).map((v) => (v ?? '').trim()).filter(Boolean).join('; ');
}

/**
 * A labelled line, or nothing.
 *
 * An absent value prints no line at all rather than "Label: —". The note is
 * read as a clinical document: a row of em dashes reads as a series of
 * negative findings, and none of them were assessed.
 */
function line(label: string, value: string | null | undefined): string | null {
  const text = (value ?? '').toString().trim();
  return text ? `${label}\t${text}` : null;
}

/** A wound's own heading, in the template's shape. */
export function woundHeading(wound: WoundNoteWound): string {
  return ['Wound', wound.type, wound.location].filter(Boolean).join(' ').trim();
}

function woundBedLines(wound: WoundNoteWound): Array<string | null> {
  const bed = wound.woundBed;
  if (!bed) return [];

  const granulation = bed.granulation?.present
    ? `Present${Number.isFinite(bed.granulation?.percent as number) ? ` (${bed.granulation?.percent}%)` : ''}`
    : bed.granulation
      ? 'No granulation tissue present'
      : null;
  const slough = bed.slough?.present
    ? `Present${Number.isFinite(bed.slough?.percent as number) ? ` (${bed.slough?.percent}%)` : ''}`
    : bed.slough
      ? 'None visible'
      : null;

  return [
    line('Granulation Tissue', granulation),
    line('Slough', slough),
    line('Eschar', bed.eschar === true ? 'Present' : bed.eschar === false ? 'None visible' : null),
    line('Epithelialization', bed.epithelial === true ? 'Present' : null),
    line('Infection Findings', joinList(bed.infection)),
    line('Other Wound Bed Characteristics', joinList(bed.other)),
  ];
}

function treatmentLines(wound: WoundNoteWound): Array<string | null> {
  const t = wound.treatment;
  if (!t) return [];
  return [
    line('Dressing Status', t.dressingAppearance),
    line('Cleanse', t.cleansing),
    line('Debridement', t.debridement),
    line('Primary Dressing', t.primary),
    line('Secondary Dressing', t.secondary),
    line('Modality', t.modalities),
    line('Additional Care', joinList(t.additionalCare)),
  ];
}

function ordersBlock(wound: WoundNoteWound): string {
  if (!wound.orders.length) return 'No associated orders.';

  const rows = wound.orders.map((order) => {
    const when = noteDateTime(order.orderedAt);
    const who = order.orderedByName ? ` — ${order.orderedByName}` : '';
    // The description is stored multi-line by the order set dialog; it is
    // reproduced as written rather than flattened, because each line is a
    // separate instruction somebody has to carry out.
    return [`${when}${who}`.trim(), order.description.trim()].filter(Boolean).join('\n');
  });

  return ['Active Orders', ...rows].join('\n');
}

function woundBlock(wound: WoundNoteWound): string {
  const header = [
    woundHeading(wound),
    [
      wound.firstAssessedAt ? `Date First Assessed: ${noteDateTime(wound.firstAssessedAt)}` : null,
      wound.type ? `Primary Wound Type: ${wound.type}` : null,
      wound.stage ? `Stage: ${wound.stage}` : null,
      wound.acquired ? `Acquired: ${wound.acquired}` : null,
      wound.location ? `Wound Location: ${wound.location}` : null,
    ].filter(Boolean).join('   '),
  ].filter(Boolean).join('\n');

  const m = wound.measurements;
  const assessment = [
    `Assessments\t${noteDateTime(wound.assessedAt)}`,
    line('Wound Length (cm)', num(m.length, 'cm')),
    line('Wound Width (cm)', num(m.width, 'cm')),
    line('Wound Depth (cm)', num(m.depth, 'cm')),
    line('Wound Surface Area (cm^2)', num(m.area, 'cm^2')),
    line('Wound Volume (cm^3)', num(m.volume, 'cm^3')),
    line('Undermining', m.undermining),
    line('Tunneling', m.tunneling),
    ...woundBedLines(wound),
    line('Wound Edges', wound.periwound?.edges),
    line('Periwound Skin', joinList(wound.periwound?.surrounding)),
    line('Periwound Skin Edema', wound.periwound?.edema),
    line('Periwound Skin Induration', wound.periwound?.induration),
    line('Periwound Skin Temperature', wound.periwound?.temperature),
    line('Exudate Type', wound.exudate?.type),
    line('Exudate Amount', wound.exudate?.amount),
    line('Odor', wound.exudate?.odor),
    line('Pain', Number.isFinite(wound.pain?.score as number)
      ? `${wound.pain?.score}/10${wound.pain?.frequency ? ` (${wound.pain?.frequency})` : ''}`
      : null),
    ...treatmentLines(wound),
    line('Goal of Care', wound.goalOfCare),
    line('Status', wound.progress?.status),
    line('Infection', wound.progress?.infection),
    line('Notes', wound.progress?.notes),
  ].filter((l): l is string => !!l).join('\n');

  return [header, '', assessment, '', ordersBlock(wound)].join('\n');
}

function educationBlock(education: WoundNoteEducation[]): string | null {
  if (!education.length) return null;
  const lines = education.map((entry) => {
    const learners = joinList(entry.learners);
    const response = joinList(entry.response);
    return [
      `•\t${entry.topic}`,
      learners ? `\to\tTaught to: ${learners}` : null,
      response ? `\to\tResponse: ${response}` : null,
    ].filter(Boolean).join('\n');
  });
  return ['Education provided this visit:', ...lines].join('\n');
}

/* --------------------------------------------------------------- builder */

/**
 * Renders the note.
 *
 * Sections with nothing in them are printed as "none on file" rather than
 * dropped, for exactly the sections a reader checks FOR absence -- past
 * medical history, past surgical history, allergies, problem list. A missing
 * allergy section is read as "not asked"; "No known allergies on file." is
 * read as asked and empty, and only one of those is true when the chart is
 * blank.
 *
 * Individual wound findings do the opposite and are omitted when absent, for
 * the same reason: a row of em dashes reads as a list of negative findings
 * nobody made.
 */
export function buildWoundProgressNote(input: WoundNoteInput): string {
  const age = ageInYears(input.patient.dob, input.recordedAt);
  const who = [
    age !== null ? `${age} y.o.` : null,
    (input.patient.gender ?? '').trim() || null,
  ].filter(Boolean).join(' ');

  const problems = (input.patient.diagnoses ?? []).filter((d) => (d ?? '').trim());
  const allergies = (input.patient.allergies ?? []).filter((a) => (a ?? '').trim());

  const sections: Array<string | null> = [
    'Wound Progress Note',
    '',
    `Reason for wound consult: ${input.reasonForConsult}`,
    '',
    input.patient.name
      ? `${input.patient.name}${who ? ` is a ${who}` : ''} with the following problems.`
      : null,
    '',
    'Problem List:',
    problems.length
      ? problems.map((d) => `•\t${d.trim()}`).join('\n')
      : 'No active problems on file.',
    '',
    `Past Medical History: ${(input.patient.pastMedicalHistory ?? '').trim() || 'No past medical history on file.'}`,
    '',
    `Past Surgical History: ${(input.patient.pastSurgicalHistory ?? '').trim() || 'No past surgical history on file.'}`,
    '',
    `Allergies: ${allergies.length ? allergies.join(' and ') : 'No known allergies on file.'}`,
    '',
    `Braden Score: ${input.bradenTotal !== null
      ? `Braden Scale Score: ${input.bradenTotal}${input.bradenRiskText ? ` — ${input.bradenRiskText}` : ''}`
      : 'No Braden score recorded.'}`,
    '',
    'Wound/Ulcer Assessment:',
    input.wounds.length
      ? input.wounds.map(woundBlock).join('\n\n')
      : 'No wounds assessed on this visit.',
    '',
    `Recommendations: ${input.recommendation}`,
    '',
    educationBlock(input.education),
    educationBlock(input.education) ? '' : null,
    `Recorded by: ${input.recordedByName}`,
    `Date: ${noteDateTime(input.recordedAt)}`,
  ];

  return sections
    .filter((section): section is string => section !== null)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
