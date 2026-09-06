/**
 * EVV -- the arrival and departure record for a visit.
 *
 * These types are a VERBATIM port of the web app's
 * src/app/models/wound-workflow.model.ts (EvvLocation, EvvCheckpoint) and
 * src/app/models/evv.ts. They are duplicated rather than shared because
 * the two apps are separate repositories with no common package -- the
 * same reason wound-vocabulary.ts is a copy. Keep them identical: a
 * checkpoint written here is read, reported on, and submitted to a state
 * Medicaid aggregator by the web app, so a field this app spells
 * differently is a field that silently disappears.
 *
 * The 21st Century Cures Act (s.12006) requires six elements per visit.
 * Four already live on the visit document; these two types carry the two
 * that make it verification rather than scheduling:
 *
 *   location of service  -> EvvCheckpoint.location
 *   service start / end  -> checkIn.at / checkOut.at
 */

/**
 * Where the device said it was -- or why it could not say.
 *
 * `status` is required and is the whole point of the type. A visit whose
 * location could not be captured must record that it could not be
 * captured; it must never fall back to the patient's address on file or
 * an empty object that reads as "not captured yet". On an audit those are
 * different facts and only one of them is true.
 */
export interface EvvLocation {
  status: 'captured' | 'denied' | 'unavailable' | 'timed_out' | 'unsupported';
  latitude?: number | null;
  longitude?: number | null;
  /** A fix accurate to 2km is not evidence of presence, so the number is
   *  kept rather than dropped once the coordinates are stored. */
  accuracyMeters?: number | null;
  source?: 'device_gps' | null;
  failureReason?: string | null;
}

/**
 * One end of a visit: arrival or departure.
 *
 * `at` is written with serverTimestamp() and is the authoritative time.
 * The device clock goes in `deviceReportedAt` and is never the time of
 * record -- a phone that is wrong, or set back deliberately, cannot move
 * an arrival time. `clockSkewSeconds` makes the disagreement visible
 * instead of discarding it.
 */
export interface EvvCheckpoint {
  at: unknown;
  deviceReportedAt?: string | null;
  clockSkewSeconds?: number | null;
  byUid: string;
  byName?: string | null;
  byRole?: string | null;
  location: EvvLocation;
  /** A time typed in afterwards is a legitimate EVV correction, but it is
   *  not the same evidence as a capture at the point of care. */
  method: 'app_capture' | 'manual_entry';
  manualReason?: string | null;
}

/** Plain-language rendering of a location, or of why there isn't one. */
export function describeEvvLocation(location: EvvLocation | null | undefined): string {
  if (!location) return 'No location recorded';
  switch (location.status) {
    case 'captured': {
      if (location.latitude == null || location.longitude == null) {
        return 'Recorded as captured but carries no coordinates';
      }
      const point = `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`;
      return location.accuracyMeters == null
        ? point
        : `${point} (±${Math.round(location.accuracyMeters)} m)`;
    }
    case 'denied': return 'Location permission refused';
    case 'timed_out': return 'Device did not return a position in time';
    case 'unavailable': return 'Device could not determine a position';
    case 'unsupported': return 'Device provides no geolocation';
    default: return 'No location recorded';
  }
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const stamp = value as { toDate?: () => Date };
  if (typeof stamp.toDate === 'function') {
    const date = stamp.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

/**
 * Minutes on site, or null when either end is missing or unreadable.
 *
 * Null, never 0. An unfinished visit has an UNKNOWN duration, and
 * reporting that as zero minutes would be a false statement about care
 * that was delivered.
 */
export function evvVisitDurationMinutes(
  visit: { checkIn?: EvvCheckpoint | null; checkOut?: EvvCheckpoint | null }
): number | null {
  const start = toDate(visit.checkIn?.at);
  const end = toDate(visit.checkOut?.at);
  if (!start || !end) return null;
  const minutes = (end.getTime() - start.getTime()) / 60_000;
  return minutes < 0 ? null : Math.round(minutes);
}
