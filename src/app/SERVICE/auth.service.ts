import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private loggedIn = new BehaviorSubject<boolean>(this.hasToken());
  isLoggedIn$: Observable<boolean> = this.loggedIn.asObservable();
  private userName = new BehaviorSubject<string | null>(null);
  userName$: Observable<string | null> = this.userName.asObservable();

  constructor(private fireAuth: AngularFireAuth, private router: Router) {}

  login(email: string, password: string) {
    this.fireAuth.signInWithEmailAndPassword(email, password).then(
      (userCredential) => {
        this.loggedIn.next(true);
        localStorage.setItem('token', 'true');
        
        // Stocker le nom de l'utilisateur après la connexion
        const user = userCredential.user;
        if (user) {
          const displayName = user.displayName || email.split('@')[0]; // Utilise displayName ou une partie de l'email comme nom
          this.userName.next(displayName);
          localStorage.setItem('userName', displayName);
        }

        this.router.navigate(['/home', { username: 'JohnDoe' }]);
      },
      (err: any) => {
        alert(err.message);
        this.router.navigate(['/login']);
      }
    );
  }

  /*
   * Self-registration was removed deliberately.
   *
   * It called createUserWithEmailAndPassword, which mints an account with
   * no organization and no role -- an account that can read nothing, and
   * that no administrator asked to exist. Accounts are created in the
   * InnovaCare admin console (adminCreateUserV2), which assigns the
   * organization, facilities and role at the same time.
   *
   * Note this is not, by itself, the control: email sign-up is enabled on
   * the Firebase project, so the REST API will still mint accounts for
   * anyone holding the public API key. Closing that is a project setting,
   * not a code change.
   */

  getUserName(): string | null {
    return localStorage.getItem('userName');
  }

  logout() {
    this.fireAuth.signOut().then(
      () => {
        this.loggedIn.next(false);
        this.userName.next(null);
        localStorage.removeItem('token');
        localStorage.removeItem('userName');
        this.router.navigate(['/login']);
      },
      (err: any) => {
        alert(err.message);
      }
    );
  }

  isLoggedIn(): boolean {
    return this.loggedIn.value;
  }

  private hasToken(): boolean {
    return !!localStorage.getItem('token');
  }
}
