// src/app/services/pin.service.ts
import { Injectable } from '@angular/core';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../firebase';

export interface PinStatus {
  hasPin: boolean;
  lockedUntilMs: number | null;
}

/**
 * The access PIN, as a second factor.
 *
 * Every check here is a call to a Cloud Function, never a comparison in
 * the app. A PIN compared on the device is theatre: whoever holds the
 * password can talk to Firestore directly and never run the check. The
 * server holds a scrypt hash, counts failures, locks out after five, and
 * records success in the `mfaPassedAt` claim -- which is cleared on every
 * sign-in, so the PIN is asked once per session and cannot be replayed
 * into the next one.
 *
 * The token is force-refreshed after each state change so the guard reads
 * the claim the server just wrote rather than the cached one.
 */
@Injectable({ providedIn: 'root' })
export class PinService {
  private readonly setFn = httpsCallable<{ pin: string; currentPin?: string }, { ok: boolean }>(
    functions, 'mobilePinSetV1');
  private readonly verifyFn = httpsCallable<{ pin: string }, { ok: boolean }>(
    functions, 'mobilePinVerifyV1');
  private readonly statusFn = httpsCallable<Record<string, never>, PinStatus>(
    functions, 'mobilePinStatusV1');

  async status(): Promise<PinStatus> {
    const res = await this.statusFn({});
    return res.data;
  }

  /** Creates the PIN, or replaces it when `currentPin` proves ownership. */
  async setPin(pin: string, currentPin?: string): Promise<void> {
    await this.setFn({ pin, currentPin });
    await this.refreshToken();
  }

  async verify(pin: string): Promise<void> {
    await this.verifyFn({ pin });
    await this.refreshToken();
  }

  /** Whether this session has already cleared the PIN. */
  async hasPassedThisSession(): Promise<boolean> {
    const user = auth.currentUser;
    if (!user) return false;
    const token = await user.getIdTokenResult(true);
    const passedAt = token.claims['mfaPassedAt'];
    return typeof passedAt === 'number' && passedAt > 0;
  }

  private async refreshToken(): Promise<void> {
    if (auth.currentUser) await auth.currentUser.getIdToken(true);
  }
}
