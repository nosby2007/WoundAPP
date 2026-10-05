import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { from, map, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private afAuth = inject(AngularFireAuth);

  // ⚠️ mets ici la même URL que ton app web
  // ex: 'https://us-central1-woundapp-261e6.cloudfunctions.net/apiV2'
  private base = environment.apiBase;

  /** Récupère les headers avec le Bearer idToken Firebase */
  private authHeaders$() {
    return from(this.afAuth.currentUser).pipe(
      switchMap(user => user ? user.getIdToken() : Promise.resolve('')),
      map(token => {
        let headers = new HttpHeaders();
        if (token) headers = headers.set('Authorization', `Bearer ${token}`);
        return headers;
      })
    );
  }

  /** GET /patients?search=... */
  listPatients(search?: string) {
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    const url = `${this.base}/patients${qs}`;

    return this.authHeaders$().pipe(
      switchMap(headers => this.http.get<any[]>(url, { headers }))
    );
  }

  /** POST /patients -- same endpoint/payload shape as the web app's PatientApiService.create(), so a patient created here shows up identically in the main app's patient list. */
  createPatient(payload: Record<string, unknown>) {
    const url = `${this.base}/patients`;

    return this.authHeaders$().pipe(
      switchMap(headers => this.http.post<{ id: string }>(url, payload, { headers }))
    );
  }
}
