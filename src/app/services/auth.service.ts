import { Injectable } from '@angular/core';
import {
  Auth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from '@angular/fire/auth';
import { httpsCallable } from 'firebase/functions';
import { BehaviorSubject } from 'rxjs';

import { functions } from '../firebase';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private userSubject = new BehaviorSubject<User | null>(null);
  user$ = this.userSubject.asObservable();

  constructor(private auth: Auth) {
    // 🔄 écouter l’état de connexion
    onAuthStateChanged(this.auth, (user) => {
      this.userSubject.next(user);
    });
  }

  /**
   * Login email + password, then publish the account's tenant into its
   * ID token.
   *
   * WHY THE SYNC IS NOT OPTIONAL
   * ----------------------------
   * `orgId` and `roles` live on users/{uid}, and syncMyClaimsV1 is what
   * copies them into the Firebase custom claims. The web app calls it on
   * every sign-in (AuthService.waitForAnyRole); this app never did, so an
   * account that has only ever signed in here has a complete user
   * document and a token with no orgId at all.
   *
   * That is invisible until something reads the TOKEN rather than the
   * document. firestore.rules is forgiving -- effectiveOrgId() reads
   * me().orgId first -- so the patient roster loads. The apiV2 Cloud
   * Function is not: resolveTenant() reads token.orgId only and answers
   * 403 tenant_scope_required. Which is exactly the reported symptom --
   * patients list fine, creating one fails.
   *
   * Failure here is deliberately not fatal to the login. A stale token
   * still reads the chart through the rules; refusing to sign the
   * clinician in because a claims refresh failed would take the whole
   * app away for a problem that only affects writes through the API.
   */
  async login(email: string, password: string) {
    const credential = await signInWithEmailAndPassword(this.auth, email, password);
    await this.syncClaims();
    return credential;
  }

  /**
   * Copy orgId/roles from users/{uid} into the ID token, then force a
   * refresh so the new claims are actually in the token this session
   * sends -- without the refresh the callable has updated the claims
   * server-side and the client is still holding the old token.
   */
  async syncClaims(): Promise<void> {
    try {
      await httpsCallable(functions, 'syncMyClaimsV1')({});
      await this.auth.currentUser?.getIdToken(true);
    } catch (error) {
      console.warn('[AuthService] syncMyClaimsV1 failed; the token may carry no orgId.', error);
    }
  }

  /** Logout */
  logout() {
    return signOut(this.auth);
  }

  /** Récupérer le user courant */
  get currentUser() {
    return this.auth.currentUser;
  }
}
