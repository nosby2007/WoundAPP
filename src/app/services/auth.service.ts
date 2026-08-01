import { Injectable, inject } from '@angular/core';
import {
  Auth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';

export interface TenantContext {
  orgId: string | null;
  facilityId: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private firestore = inject(Firestore);
  private userSubject = new BehaviorSubject<User | null>(null);
  user$ = this.userSubject.asObservable();

  constructor(private auth: Auth) {
    // 🔄 écouter l’état de connexion
    onAuthStateChanged(this.auth, (user) => {
      this.userSubject.next(user);
    });
  }

  /** Login email + password */
  login(email: string, password: string) {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  /** Logout */
  logout() {
    return signOut(this.auth);
  }

  /** Récupérer le user courant */
  get currentUser() {
    return this.auth.currentUser;
  }

  /**
   * Resolves the signed-in nurse's org/facility for stamping new records
   * (e.g. patient intake). Reads users/{uid}, same field-name fallbacks
   * (orgId/orgID/tenantId/tenantID, facilityId/facilityID/primaryFacilityId)
   * as the web app's TenantContextService, so a patient created here is
   * indistinguishable from one created in the main app.
   */
  async getTenantContext(): Promise<TenantContext> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) return { orgId: null, facilityId: null };

    const snap = await getDoc(doc(this.firestore, `users/${uid}`));
    const data = (snap.data() as Record<string, unknown>) ?? {};

    const orgId =
      this.readString(data, 'orgId') ??
      this.readString(data, 'orgID') ??
      this.readString(data, 'tenantId') ??
      this.readString(data, 'tenantID');

    const facilityId =
      this.readString(data, 'facilityId') ??
      this.readString(data, 'facilityID') ??
      this.readString(data, 'primaryFacilityId');

    return { orgId, facilityId };
  }

  private readString(source: Record<string, unknown>, key: string): string | null {
    const value = source[key];
    return typeof value === 'string' && value.trim() ? value : null;
  }
}
