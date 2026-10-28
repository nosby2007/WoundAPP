import {
  HOME_CARE_EVENT_CLASSES,
  homeCareEventClass,
  homeCareEventOption,
  jadeIncidentCategory,
} from './home-care-event';

describe('home-care event catalog', () => {
  it('keeps the portal limited to patient, concern and staff home-care workflows', () => {
    expect(HOME_CARE_EVENT_CLASSES.map(item => item.value)).toEqual([
      'patient_safety',
      'patient_concern',
      'staff_safety',
    ]);
    expect(homeCareEventClass('visitor_event')).toBeNull();
  });

  it('omits inpatient-only event categories', () => {
    const values = HOME_CARE_EVENT_CLASSES.flatMap(item => item.options.map(option => option.value));
    expect(values).not.toContain('blood_product');
    expect(values).not.toContain('diagnostic_radiology');
    expect(values).not.toContain('laboratory');
  });

  it('maps richer mobile types to categories understood by JADE', () => {
    expect(jadeIncidentCategory('patient_safety', 'fall')).toBe('Fall');
    expect(jadeIncidentCategory('patient_safety', 'medication')).toBe('Medication');
    expect(jadeIncidentCategory('patient_safety', 'skin_integrity')).toBe('Injury');
    expect(jadeIncidentCategory('patient_concern', 'communication')).toBe('Other');
    expect(homeCareEventOption('staff_safety', 'unsafe_home')?.label).toContain('Unsafe home');
  });
});
