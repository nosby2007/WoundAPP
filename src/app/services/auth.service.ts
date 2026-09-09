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
import { TenantService } from './tenant.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private userSubject = new BehaviorSubject<User | null>(null);
  user$ = this.userSubject.asObservable();

  constructor(private auth: Auth, private tenant: TenantService) {
    onAuthStateChanged(this.auth, (user) => {
      this.userSubject.next(user);
      if (!user) this.tenant.reset();
    });
  }

  async login(email: string, password: string) {
    const credential = await signInWithEmailAndPassword(this.auth, email, password);
    await this.syncClaims();
    return credential;
  }

  async syncClaims(): Promise<void> {
    try {
      await httpsCallable(functions, 'syncMyClaimsV1')({});
      await this.auth.currentUser?.getIdToken(true);
    } catch (error) {
      console.warn('[AuthService] syncMyClaimsV1 failed; the token may carry no orgId.', error);
    }
  }

  /**
   * End the Firebase session and clear tenant-derived client state so a second
   * clinician on a shared field device cannot inherit the prior user's org.
   */
  async logout(): Promise<void> {
    try {
      await signOut(this.auth);
    } finally {
      this.tenant.reset();
      this.userSubject.next(null);
    }
  }

  get currentUser() {
    return this.auth.currentUser;
  }
}
