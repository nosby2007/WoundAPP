// src/app/guards/pin.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { auth, authStateReady } from '../firebase';
import { PinService } from '../services/pin.service';

/**
 * Holds the signed-in area behind the access PIN.
 *
 * The guard gates the ROUTE only. What protects the records is
 * firestore.rules, which the PIN feeds through the `mfaPassedAt` claim --
 * so someone who skipped this screen by editing the URL still reads
 * nothing they should not.
 */
export const pinGuard: CanActivateFn = async (_route, state) => {
  const router = inject(Router);
  const pin = inject(PinService);

  // Firebase restores persisted auth asynchronously on a hard refresh.
  // Wait before deciding the clinician is signed out.
  await authStateReady;

  if (!auth.currentUser) {
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url },
    });
  }

  if (await pin.hasPassedThisSession()) return true;

  return router.createUrlTree(['/pin'], {
    queryParams: { returnUrl: state.url },
  });
};
