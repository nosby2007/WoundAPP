// src/app/pages/progress-note/progress-note.page.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonAvatar,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { alertCircleOutline, peopleCircleOutline } from 'ionicons/icons';

import { NoOrganizationError, Patient, PatientService } from 'src/app/services/patient.service';
import {
  patientAge,
  patientAvatarHue,
  patientInitials,
  patientMatches,
  toDate,
} from 'src/app/shared/patient-display';

/**
 * Step one of writing a note in the field: which patient.
 *
 * The tab has to start somewhere, and a note is meaningless without a
 * patient, so the tab lands on the roster rather than on an empty form.
 */
@Component({
  selector: 'app-progress-note',
  standalone: true,
  templateUrl: './progress-note.page.html',
  styleUrls: ['./progress-note.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonAvatar,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonRefresher,
    IonRefresherContent,
    IonSearchbar,
    IonSpinner,
    IonTitle,
    IonToolbar,
  ],
})
export class ProgressNotePage {
  private patients = inject(PatientService);
  private router = inject(Router);

  all: Patient[] = [];
  search = '';
  loading = true;
  errorMsg = '';

  // Template helpers, shared with the Patients roster.
  initials = patientInitials;
  avatarHue = patientAvatarHue;
  age = patientAge;
  toDate = toDate;

  constructor() {
    addIcons({ alertCircleOutline, peopleCircleOutline });
  }

  ionViewWillEnter() {
    this.load();
  }

  get filtered(): Patient[] {
    return this.all.filter((p) => patientMatches(p, this.search));
  }

  async load(event?: any) {
    this.loading = !event;
    this.errorMsg = '';
    try {
      this.all = await this.patients.listPatients();
    } catch (err: any) {
      console.error('Error loading patients for progress note', err);
      this.errorMsg = err instanceof NoOrganizationError
        ? 'Your account is not linked to an organization. Ask an administrator to assign yours.'
        : 'Unable to load patients';
    } finally {
      this.loading = false;
      event?.target?.complete();
    }
  }

  open(p: Patient) {
    this.router.navigate(['/tabs', 'progress-note', p.id]);
  }
}
