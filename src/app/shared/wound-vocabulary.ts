// src/app/shared/wound-vocabulary.ts
//
// The option lists a wound assessment offers.
//
// These are NOT authored here. Every list below is copied verbatim from the
// web app's assessment form -- JADE-SHOP,
// src/app/features/skin-wound/components/assessment-form/assessment-form.component.ts
// -- which is the authoritative set for this product. The mobile app writes
// into the same `patients/{id}/woundAssessments` documents that form reads, so
// any value the phone offers has to be a value the chart already understands.
//
// If a list changes there, change it here too. Do not add entries to either
// one without the clinical owner: these strings end up in the patient's
// record and in the Medicare audit packets built from it.

export const WOUND_TYPES = [
  'Pressure', 'Skin Tear', 'Diabetic', 'Venous', 'Arterial', 'Surgical', 'MASD',
  'Rash', 'Blister', 'Laceration', 'Open Lesion', 'Hematoma', 'Burn', 'Abscess', 'Other',
] as const;

export const STAGES = [
  'Stage 1', 'Stage 2', 'Stage 3', 'Stage 4',
  'Deep Tissue Injury', 'Mucosal Membrane', 'Unstageable',
] as const;

export const ACQUIRED = ['In-House Acquired', 'Present on Admission'] as const;

export const STAGED_BY = [
  'N/A', 'In-house nursing', 'Home Health', 'Hospice',
  'Health Care Provider', 'Wound Care Clinic', 'Other',
] as const;

export const STATUS = [
  'New', 'Improving', 'Stable', 'Stalled', 'Deteriorating', 'Monitoring', 'Resolved',
] as const;

/* --- Measurements ------------------------------------------------------- */
export const UNDERMINING = ['None', 'Mild', 'Moderate', 'Severe'] as const;
export const TUNNELING = ['None', 'Mild', 'Moderate', 'Severe'] as const;

/* --- Exudate ------------------------------------------------------------ */
export const EXUDATE_AMOUNTS = ['None', 'Light', 'Moderate', 'Heavy'] as const;
export const EXUDATE_TYPES = [
  'None', 'Serous', 'Sanguineous/Bloody', 'Serosanguineous', 'Purulent', 'Seropurulent',
] as const;
export const ODORS = ['None', 'Faint', 'Moderate', 'Strong'] as const;

/* --- Wound bed ---------------------------------------------------------- */
export const INFECTION_SIGNS = [
  'Fever', 'Increased drainage', 'Increased pain', 'Malaise',
  'Redness/inflammation', 'Streaking', 'Warmth', 'None',
] as const;

export const WOUND_OTHER = [
  'Bleeding', 'Bone', 'Fibrin', 'Gangrene', 'Hematoma', 'Hypergranulated',
  'Intact blister', 'Islands of epithelium', 'Pink or red',
  'Ruptured blister', 'Scab', 'Sutured', 'None', 'Other',
] as const;

/* --- Peri-wound --------------------------------------------------------- */
export const EDGES = [
  'Attached', 'Non-Attached', 'Rolled Edge (Epibole)', 'Epithelialization',
] as const;

export const SURROUNDING = [
  'Boggy', 'Callus', 'Cavern', 'Cyanosis', 'Dry/Scaly', 'Denuded', 'Dermatitis',
  'Erythema', 'Erosion', 'Excoriation', 'Edema', 'Fluctuance', 'Fragile',
  'Fluctuant', 'Hemosiderin staining', 'Induration', 'Maceration', 'Moist',
  'Non-blanchable erythema', 'Pain', 'Peeling/Desquamation', 'Petechiae',
  'Purple discoloration', 'Rash', 'Rubor', 'Scar', 'Skin tear', 'Undermining',
  'Warmth', 'Dry crust', 'None',
] as const;

export const INDURATION = ['None present', '<2cm', '2-4 cm <50%'] as const;

export const EDEMA = [
  'No swelling or edema', 'Non-pitting < 4cm', 'Non-pitting > 4cm',
  'Pitting < 4 cm', 'Pitting > 4 cm',
] as const;

export const TEMPERATURE = ['Cool', 'Normal', 'Warm', 'Hot'] as const;

/* --- Pain / progress ---------------------------------------------------- */
export const PAIN_FREQUENCY = ['None', 'Intermittent', 'Constant', 'With dressing change'] as const;
export const INFECTION_STATUS = ['None', 'Suspected', 'MD/Provider diagnosed infection'] as const;
export const GOALS_OF_CARE = ['Healable', 'Slow to Heal', 'Monitor/Manage'] as const;
export const DRESSING_APPEARANCE = ['Intact', 'Missing', 'Dry', 'Saturated', 'Leaking', 'None'] as const;
