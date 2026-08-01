import { Injectable } from '@angular/core';
import {
  Auth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from '@angular/fire/auth';
import { BehaviorSubject } from 'rxjs';

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
}
