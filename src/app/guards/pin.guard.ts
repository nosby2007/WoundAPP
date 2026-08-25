// src/app/guards/pin.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { auth } from '../firebase';
import { PinService } from '../services/pin.service';

/**
 * Holds the signed-in area behind the access PIN.
 *
 * The guard gates the ROUTE only. What protects the records is
 * firestore.rules, which the PIN feeds through the `mfaPassedAt` claim --
 * so someone who skipped this screen by editing the URL still reads
 * nothing they should not.
 */
export const pinGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const pin = inject(PinService);

  if (!auth.currentUser) {
    return router.createUrlTree(['/login']);
  }

  if (await pin.hasPassedThisSession()) return true;

  return router.createUrlTree(['/pin']);
};
