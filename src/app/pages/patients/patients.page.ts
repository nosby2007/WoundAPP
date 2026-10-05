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
import { addIcons } from 'ionicons';
import {
  personAddOutline,
  personCircle,
  alertCircleOutline,
  peopleCircleOutline,
} from 'ionicons/icons';
import { NoOrganizationError, PatientService } from 'src/app/services/patient.service';
import {
  patientAge,
  patientAvatarHue,
  patientInitials,
  toDate,
} from 'src/app/shared/patient-display';


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
  ) {
    // Same registration the assessments page does -- without it these
    // four icons render as empty space.
    addIcons({ personAddOutline, personCircle, alertCircleOutline, peopleCircleOutline });
  }

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

  // Shared with the progress-note picker, which renders the same row.
  initials = patientInitials;
  avatarHue = patientAvatarHue;
  age = patientAge;
  toDate = toDate;
}
