import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { map, take } from 'rxjs/operators';

/**
 * Requires a real Firebase session.
 *
 * This used to read a `token` flag out of localStorage, which any visitor
 * could set by hand -- and which stayed `true` long after the session
 * behind it had expired, so the app would render its shell and then fail
 * every query. Asking Firebase directly means the guard and the database
 * agree on whether the user is signed in.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthGuardGuard implements CanActivate {
  constructor(private afAuth: AngularFireAuth, private router: Router) {}

  canActivate() {
    return this.afAuth.authState.pipe(
      take(1),
      map((user) => {
        if (user) return true;
        this.router.navigate(['login']);
        return false;
      }),
    );
  }
}
