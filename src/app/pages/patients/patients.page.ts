import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSpinner,
  IonList,
  IonItem,
  IonAvatar,
  IonLabel,
  IonIcon,
  IonButtons,
  IonButton,
} from '@ionic/angular/standalone';
import { Subscription } from 'rxjs';
import { NoOrganizationError, PatientService } from 'src/app/services/patient.service';


@Component({
  selector: 'app-patients',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonSearchbar,
    IonSpinner,
    IonList,
    IonItem,
    IonAvatar,
    IonLabel,
    IonIcon,
    IonButtons,
    IonButton,
  ],
  templateUrl: './patients.page.html',
  styleUrls: ['./patients.page.scss'],
})
export class PatientsPage implements OnDestroy {
  patients: any[] = [];
  search = '';
  loading = false;
  errorMsg = '';

  private sub?: Subscription;

  constructor(
    private patientsFs: PatientService,
    private router: Router
  ) {}

  ionViewWillEnter() {
    this.load();
  }

  ionViewDidLeave() {
    this.sub?.unsubscribe();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  /** Charge depuis Firestore */
  async load(event?: CustomEvent) {
    this.loading = true;
    this.errorMsg = '';
    this.sub?.unsubscribe();

    try {
      const items = await this.patientsFs.listPatients(200);
      this.patients = items || [];
      this.loading = false;
      (event?.target as any)?.complete();
    } catch (err: any) {
      console.error('❌ Error loading patients', err);
      this.errorMsg = err instanceof NoOrganizationError
        ? 'Your account is not linked to an organization. Ask an administrator to assign yours.'
        : 'Unable to load patients';
      this.loading = false;
      (event?.target as any)?.complete();
    }
     this.loading = false;
  }

  /** Filtre local par name/MRN */
get filteredPatients() {
  const q = (this.search || '').toLowerCase().trim();
  if (!q) {
    // ⚠️ on filtre déjà ici les faux docs style "[Signal: xxx]"
    return this.patients.filter(p => !String(p.id).startsWith('[Signal:'));
  }

  return this.patients
    .filter(p => !String(p.id).startsWith('[Signal:'))   // <- ignore les "Signal"
    .filter((p) => {
      const name = (p.name || p.displayName || '').toLowerCase();
      const dob = (p.dob || '').toLowerCase();
      return name.includes(q) || dob.includes(q);
    });
}


  /** Ouvrir un patient (pour plus tard, liste des plaies) */
 // src/app/pages/patients/patients.page.ts
/** Ouvrir un patient (liste des plaies) */
openPatient(p: any) {
  console.log('[PatientsPage] openPatient raw', p);

  // on nettoie au cas où un jour un id "Signal" traînerait
  let patientId: string =
    p.patientId ||
    p.id ||
    '';

  // si jamais quelqu’un a un id du style "[Signal: xxxxx]"
  if (patientId.startsWith('[Signal:')) {
    const inside = patientId.replace('[Signal:', '').replace(']', '').trim();
    console.warn('⚠️ patientId ressemblait à un Signal, on corrige =>', inside);
    patientId = inside;
  }

  console.log('[PatientsPage] navigate with patientId =', patientId);

  this.router.navigate(
    ['/tabs', 'skin-wound', patientId, 'assessments'],
  );
}



  doRefresh(event: CustomEvent) {
    this.load(event);
  }

  goAddPatient() {
    this.router.navigate(['/tabs', 'add-patient']);
  }

  /**
   * Initials, for when a patient has no photo.
   *
   * A generic silhouette on every row makes the list harder to scan, not
   * easier -- initials give the eye something to land on while claiming
   * nothing untrue about who the person is.
   */
  initials(p: any): string {
    const parts = String(p?.name || p?.displayName || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    const first = parts[0][0] || '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  }

  /** A stable colour per patient, so the same chart looks the same tomorrow. */
  avatarHue(p: any): number {
    const source = String(p?.id || p?.name || '');
    let hash = 0;
    for (let i = 0; i < source.length; i += 1) {
      hash = (hash * 31 + source.charCodeAt(i)) % 360;
    }
    return hash;
  }

  /**
   * Age from the date of birth.
   *
   * Shown beside the date because on a ward the age is what gets checked,
   * and deriving it from the same field keeps the two from disagreeing.
   */
  age(p: any): number | null {
    const dob = this.toDate(p?.dob);
    if (!dob) return null;
    const now = new Date();
    let years = now.getFullYear() - dob.getFullYear();
    const monthDelta = now.getMonth() - dob.getMonth();
    if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) years -= 1;
    return years >= 0 && years < 150 ? years : null;
  }

  /** Records carry the date as an ISO string, a Date, or a Firestore Timestamp. */
  toDate(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
    if (typeof value?.toDate === 'function') return value.toDate();
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
}
