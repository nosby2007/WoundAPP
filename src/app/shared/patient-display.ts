// src/app/shared/patient-display.ts
//
// How a patient is rendered in a list row. These lived as methods on
// PatientsPage; the progress-note picker needs exactly the same treatment,
// and a second copy would be a second place for the initials or the age to
// drift.

/**
 * Initials, for when a patient has no photo.
 *
 * A generic silhouette on every row makes the list harder to scan, not
 * easier -- initials give the eye something to land on while claiming
 * nothing untrue about who the person is.
 */
export function patientInitials(p: any): string {
  const parts = String(p?.name || p?.displayName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0][0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/** A stable colour per patient, so the same chart looks the same tomorrow. */
export function patientAvatarHue(p: any): number {
  const source = String(p?.id || p?.name || '');
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) % 360;
  }
  return hash;
}

/** Records carry dates as an ISO string, a Date, or a Firestore Timestamp. */
export function toDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Age from the date of birth.
 *
 * Shown beside the date because on a ward the age is what gets checked,
 * and deriving it from the same field keeps the two from disagreeing.
 */
export function patientAge(p: any): number | null {
  const dob = toDate(p?.dob);
  if (!dob) return null;
  const now = new Date();
  let years = now.getFullYear() - dob.getFullYear();
  const monthDelta = now.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) years -= 1;
  return years >= 0 && years < 150 ? years : null;
}

/** Matches a patient against a free-text search over name, MRN and DOB. */
export function patientMatches(p: any, term: string): boolean {
  const q = (term || '').toLowerCase().trim();
  if (!q) return true;
  const dob = toDate(p?.dob);
  const haystack = [
    p?.name, p?.displayName, p?.mrn, p?.room, p?.dob,
    dob ? dob.toLocaleDateString('en-US') : '',
  ].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(q);
}
