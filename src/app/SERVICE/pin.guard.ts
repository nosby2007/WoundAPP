import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { PinService } from './pin.service';

/**
 * Holds every signed-in route behind the access PIN.
 *
 * The guard gates the ROUTE only. What actually protects the records is
 * firestore.rules, which the PIN feeds through the `mfaPassedAt` claim --
 * so someone who skipped this screen by editing the URL still reads
 * nothing they should not.
 */
@Injectable({ providedIn: 'root' })
export class PinGuard implements CanActivate {
  constructor(
    private pin: PinService,
    private afAuth: AngularFireAuth,
    private router: Router,
  ) {}

  async canActivate(): Promise<boolean> {
    const user = await this.afAuth.currentUser;
    if (!user) {
      this.router.navigate(['/login']);
      return false;
    }

    if (await this.pin.hasPassedThisSession()) return true;

    this.router.navigate(['/pin']);
    return false;
  }
}
