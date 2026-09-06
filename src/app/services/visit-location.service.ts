import { Injectable } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';

import { EvvLocation } from '../shared/evv';

/**
 * Reads the device position for an EVV checkpoint.
 *
 * This service NEVER rejects. Permission refused, no fix inside a
 * building, location services switched off, an old handset with no GPS --
 * each resolves to an EvvLocation carrying the reason. A thrown error
 * would leave the caller deciding what to write, and the tempting wrong
 * answer is to write nothing and let the field read as "not captured
 * yet". A visit where the clinician refused location access and a visit
 * nobody checked into are different facts, and on a Medicaid audit only
 * one of them is true.
 *
 * Uses @capacitor/geolocation rather than navigator.geolocation. On
 * Android the WebView's own geolocation needs the app to hold
 * ACCESS_FINE_LOCATION and to answer the WebChromeClient permission
 * prompt; the plugin handles the native runtime permission on both
 * platforms and falls back to the browser API on the web build, so one
 * call behaves the same everywhere. The manifest permissions this needs
 * are declared in android/app/src/main/AndroidManifest.xml.
 *
 * It is a single reading at a single moment, deliberately. This is not
 * tracking: nothing here watches a position, and EVV asks where the visit
 * happened, not where the clinician has been.
 */
@Injectable({ providedIn: 'root' })
export class VisitLocationService {
  /** Long enough for a cold fix indoors, short enough that a clinician
   *  standing in a doorway is not left watching a spinner. */
  private static readonly TIMEOUT_MS = 15_000;

  /** A fix older than this is a previous location, not this visit's. */
  private static readonly MAX_AGE_MS = 30_000;

  async capture(): Promise<EvvLocation> {
    try {
      // Ask first: on iOS and Android the prompt is the difference
      // between a real fix and an instant refusal.
      const permission = await Geolocation.checkPermissions().catch(() => null);
      if (permission && permission.location === 'prompt') {
        await Geolocation.requestPermissions().catch(() => null);
      }

      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: VisitLocationService.TIMEOUT_MS,
        maximumAge: VisitLocationService.MAX_AGE_MS,
      });

      return {
        status: 'captured',
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        // Kept, not dropped: coordinates good only to within 2km are not
        // evidence that anybody was at the address.
        accuracyMeters: typeof position.coords.accuracy === 'number' ? position.coords.accuracy : null,
        source: 'device_gps',
        failureReason: null,
      };
    } catch (error: unknown) {
      return this.fromError(error);
    }
  }

  /** The platform's own message is kept verbatim -- it is what a
   *  clinician will be asked about later, and paraphrasing loses it. */
  private fromError(error: unknown): EvvLocation {
    const message = (error as { message?: string })?.message ?? '';
    const lowered = message.toLowerCase();

    if (lowered.includes('denied') || lowered.includes('permission')) {
      return { status: 'denied', failureReason: message || 'Location permission was refused.' };
    }
    if (lowered.includes('timeout') || lowered.includes('timed out')) {
      return { status: 'timed_out', failureReason: message || 'The device did not return a position in time.' };
    }
    if (lowered.includes('not available') || lowered.includes('unsupported') || lowered.includes('not implemented')) {
      return { status: 'unsupported', failureReason: message || 'This device provides no geolocation.' };
    }
    return { status: 'unavailable', failureReason: message || 'The device could not determine a position.' };
  }
}
