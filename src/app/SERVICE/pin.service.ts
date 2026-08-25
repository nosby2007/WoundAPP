import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { firstValueFrom } from 'rxjs';

export interface PinStatus {
  hasPin: boolean;
  lockedUntilMs: number | null;
}

/**
 * The access PIN, as a second factor.
 *
 * Every check here is a call to a Cloud Function, never a comparison in
 * the browser. A PIN compared client-side is theatre: whoever holds the
 * password can skip the screen entirely and talk to Firestore directly.
 * The server holds the hash, counts the failures, and records success in
 * the `mfaPassedAt` claim, which is cleared on every sign-in -- so the
 * PIN is asked for once per session and cannot be replayed into the next.
 *
 * The token is force-refreshed after each state change so the guard reads
 * the claim the server just wrote, rather than the cached one from before.
 */
@Injectable({ providedIn: 'root' })
export class PinService {
  constructor(
    private fns: AngularFireFunctions,
    private afAuth: AngularFireAuth,
  ) {}

  status(): Promise<PinStatus> {
    return firstValueFrom(
      this.fns.httpsCallable<Record<string, never>, PinStatus>('mobilePinStatusV1')({}),
    );
  }

  /** Creates the PIN, or replaces it when `currentPin` proves ownership. */
  async setPin(pin: string, currentPin?: string): Promise<void> {
    await firstValueFrom(
      this.fns.httpsCallable<{ pin: string; currentPin?: string }, { ok: boolean }>(
        'mobilePinSetV1',
      )({ pin, currentPin }),
    );
    await this.refreshToken();
  }

  async verify(pin: string): Promise<void> {
    await firstValueFrom(
      this.fns.httpsCallable<{ pin: string }, { ok: boolean }>('mobilePinVerifyV1')({ pin }),
    );
    await this.refreshToken();
  }

  /** Whether this session has already cleared the PIN. */
  async hasPassedThisSession(): Promise<boolean> {
    const user = await this.afAuth.currentUser;
    if (!user) return false;
    const token = await user.getIdTokenResult(true);
    const passedAt = token.claims['mfaPassedAt'];
    return typeof passedAt === 'number' && passedAt > 0;
  }

  private async refreshToken(): Promise<void> {
    const user = await this.afAuth.currentUser;
    if (user) await user.getIdToken(true);
  }
}
