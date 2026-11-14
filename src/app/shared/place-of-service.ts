/**
 * CMS place-of-service codes (same list as JADE src/app/core/place-of-service.ts).
 * The visit stores the two-digit code. A scheduler's facility is NOT a place of
 * service: the code comes from the appointment; "facility" is never written.
 */
export const PLACES_OF_SERVICE: ReadonlyArray<{ code: string; label: string }> = Object.freeze([
  { code: '12', label: 'Home (patient residence)' },
  { code: '13', label: 'Assisted living facility' },
  { code: '33', label: 'Custodial care facility' },
  { code: '31', label: 'Skilled nursing facility' },
  { code: '32', label: 'Nursing facility' },
  { code: '11', label: 'Office' },
  { code: '22', label: 'Outpatient hospital (on campus)' },
  { code: '10', label: 'Telehealth in patient home' },
  { code: '02', label: 'Telehealth (other than patient home)' },
]);

export function placeOfServiceCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase().replace(/^pos\s*/, '');
  if (PLACES_OF_SERVICE.some((p) => p.code === v)) return v;
  if (['home', 'patient home', 'residence', 'home_health'].includes(v)) return '12';
  if (['office', 'clinic'].includes(v)) return '11';
  return null;
}

/**
 * Place of service for a field visit: the scheduler's code, else home (12) when the
 * appointment has no facility, else null (the office confirms it; never a guess).
 */
export function fieldVisitPlaceOfService(appointment: Record<string, unknown>): string | null {
  return placeOfServiceCode(appointment['placeOfService']) ?? (appointment['facilityId'] ? null : '12');
}

/** YYYY-MM-DD in the device's local time zone (an evening visit must not become tomorrow's UTC date). */
export function localIsoDate(value: unknown): string {
  let d: Date | null = null;
  if (value instanceof Date) d = value;
  else if (value && typeof (value as any).toDate === 'function') d = (value as any).toDate();
  else if (typeof value === 'string' || typeof value === 'number') d = new Date(value);
  if (!d || Number.isNaN(d.getTime())) d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
