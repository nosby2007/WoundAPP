export type HomeCareEventClass = 'patient_safety' | 'patient_concern' | 'staff_safety';

export type HomeCareEventSeverity = 'None' | 'Minor' | 'Moderate' | 'Major' | 'Death';

export interface HomeCareEventOption {
  value: string;
  label: string;
  description?: string;
}
export interface HomeCareEventClassDefinition {
  value: HomeCareEventClass;
  label: string;
  shortLabel: string;
  description: string;
  icon: string;
  requiresPatient: boolean;
  options: HomeCareEventOption[];
}
export const HOME_CARE_EVENT_CLASSES: readonly HomeCareEventClassDefinition[] = [
  {
    value: 'patient_safety',
    label: 'Patient safety event',
    shortLabel: 'Patient event',
    description: 'Report an event, near miss, injury, or unexpected clinical occurrence during home care.',
    icon: 'medkit-outline',
    requiresPatient: true,
    options: [
      { value: 'fall', label: 'Fall', description: 'Witnessed or unwitnessed, assisted or unassisted.' },
      { value: 'skin_integrity', label: 'Skin integrity', description: 'Skin tear, pressure injury, burn, laceration, or other skin injury.' },
      { value: 'injury', label: 'Other patient injury', description: 'An injury not better described by another option.' },
      { value: 'medication', label: 'Medication or other substance', description: 'Wrong dose, missed dose, reaction, discrepancy, or near miss.' },
      { value: 'medical_emergency', label: 'Medical emergency', description: 'Acute change such as choking, seizure, unresponsiveness, or severe symptoms.' },
      { value: 'equipment_device', label: 'Equipment or device', description: 'Failure, misuse, or concern involving medical or therapy equipment.' },
      { value: 'treatment_procedure', label: 'Treatment or procedure', description: 'Unexpected event involving care delivery, consent, or treatment.' },
      { value: 'patient_behavior', label: 'Patient behavior', description: 'Elopement, self-harm concern, substance use, aggression, or refusal with safety impact.' },
      { value: 'tube_line', label: 'Tube or line dislodgement', description: 'Unexpected removal or displacement of a tube, catheter, or line.' },
      { value: 'other', label: 'Other patient event' },
    ],
  },
  {
    value: 'patient_concern',
    label: 'Patient or family concern',
    shortLabel: 'Concern / grievance',
    description: 'Record a complaint, grievance, or concern reported by or on behalf of a patient.',
    icon: 'chatbox-ellipses-outline',
    requiresPatient: true,
    options: [
      { value: 'quality_of_care', label: 'Quality of care' },
      { value: 'communication', label: 'Communication' },
      { value: 'scheduling_access', label: 'Scheduling or access' },
      { value: 'privacy_confidentiality', label: 'Privacy or confidentiality' },
      { value: 'billing_service', label: 'Billing or service concern' },
      { value: 'staff_conduct', label: 'Staff conduct' },
      { value: 'discrimination', label: 'Discrimination or accessibility' },
      { value: 'other', label: 'Other concern' },
    ],
  },
  {
    value: 'staff_safety',
    label: 'Staff safety event',
    shortLabel: 'Staff safety',
    description: 'Report a staff injury, exposure, threat, or unsafe condition connected to a home visit.',
    icon: 'shield-checkmark-outline',
    requiresPatient: false,
    options: [
      { value: 'workplace_violence', label: 'Workplace violence or threat' },
      { value: 'staff_injury', label: 'Staff injury' },
      { value: 'exposure', label: 'Blood, body fluid, or infectious exposure' },
      { value: 'unsafe_home', label: 'Unsafe home or environment' },
      { value: 'harassment', label: 'Harassment or intimidation' },
      { value: 'transportation', label: 'Vehicle or transportation event' },
      { value: 'animal_hazard', label: 'Animal hazard' },
      { value: 'other', label: 'Other staff safety event' },
    ],
  },
] as const;

export const HOME_CARE_LOCATIONS: readonly HomeCareEventOption[] = [
  { value: 'patient_home', label: 'Patient home' },
  { value: 'community', label: 'Community setting' },
  { value: 'vehicle', label: 'Vehicle / in transit' },
  { value: 'office', label: 'Office' },
  { value: 'telehealth', label: 'Telehealth / telephone' },
  { value: 'other', label: 'Other location' },
] as const;

export function homeCareEventClass(value: unknown): HomeCareEventClassDefinition | null {
  return HOME_CARE_EVENT_CLASSES.find(item => item.value === value) || null;
}

export function homeCareEventOption(eventClass: HomeCareEventClass, value: unknown): HomeCareEventOption | null {
  return homeCareEventClass(eventClass)?.options.find(item => item.value === value) || null;
}

/**
 * Keep mobile reports readable by JADE's existing Risk Management dashboard.
 * The richer home-care classification remains in eventClass/eventType.
 */
export function jadeIncidentCategory(eventClass: HomeCareEventClass, eventType: string): 'Fall' | 'Medication' | 'Behavior' | 'Injury' | 'Other' {
  if (eventClass !== 'patient_safety') return 'Other';
  if (eventType === 'fall') return 'Fall';
  if (eventType === 'medication') return 'Medication';
  if (eventType === 'patient_behavior') return 'Behavior';
  if (['skin_integrity', 'injury', 'medical_emergency', 'equipment_device', 'treatment_procedure', 'tube_line'].includes(eventType)) return 'Injury';
  return 'Other';
}
