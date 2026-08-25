// src/app/pages/progress-note-form/progress-note-form.page.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { doc, getDoc } from 'firebase/firestore';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { alertCircleOutline, documentTextOutline } from 'ionicons/icons';

import { db } from 'src/app/firebase';
import { NotAuthenticatedError, ProgressNote, ProgressNoteService } from 'src/app/services/progress-note.service';
import { patientAge, patientAvatarHue, patientInitials, toDate } from 'src/app/shared/patient-display';

/**
 * Write a progress note on one patient.
 *
 * Deliberately one free-text field. The note lands in the same collection
 * the providers read, and the clinical vocabularies in this product
 * (wound types, debridement, order sets) are authored by administrators --
 * inventing a set of quick-pick phrases here would put words in a
 * clinician's chart that nobody approved.
 */
@Component({
  selector: 'app-progress-note-form',
  standalone: true,
  templateUrl: './progress-note-form.page.html',
  styleUrls: ['./progress-note-form.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonSpinner,
    IonTextarea,
    IonTitle,
    IonToolbar,
  ],
})
export class ProgressNoteFormPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private notes = inject(ProgressNoteService);
  private toasts = inject(ToastController);

  patientId = this.route.snapshot.paramMap.get('patientId') || '';
  patient: any = null;

  details = '';
  saving = false;
  loadingHistory = true;
  errorMsg = '';
  recent: ProgressNote[] = [];

  initials = patientInitials;
  avatarHue = patientAvatarHue;
  age = patientAge;
  toDate = toDate;

  constructor() {
    addIcons({ alertCircleOutline, documentTextOutline });
  }

  async ngOnInit() {
    await Promise.all([this.loadPatient(), this.loadHistory()]);
  }

  private async loadPatient() {
    if (!this.patientId) return;
    try {
      const snap = await getDoc(doc(db, 'patients', this.patientId));
      if (snap.exists()) this.patient = { id: snap.id, ...(snap.data() as any) };
    } catch (err) {
      // The header is a convenience; a failure here must not block writing.
      console.error('Could not load the patient header', err);
    }
  }

  private async loadHistory() {
    this.loadingHistory = true;
    try {
      this.recent = await this.notes.list(this.patientId);
    } catch (err) {
      console.error('Could not load recent notes', err);
      this.recent = [];
    } finally {
      this.loadingHistory = false;
    }
  }

  get canSave(): boolean {
    return !this.saving && this.details.trim().length > 0;
  }

  async save() {
    if (!this.canSave) return;
    this.saving = true;
    this.errorMsg = '';

    try {
      await this.notes.create(this.patientId, this.details);
      this.details = '';
      await this.loadHistory();

      const toast = await this.toasts.create({
        message: 'Note saved to the chart.',
        duration: 2200,
        position: 'bottom',
        color: 'success',
      });
      await toast.present();
    } catch (err: any) {
      console.error('Error saving progress note', err);
      this.errorMsg = err instanceof NotAuthenticatedError
        ? err.message
        : err?.code === 'permission-denied'
          ? 'Your account is not allowed to write notes on this patient.'
          : 'Could not save the note. It is still in the box -- try again.';
    } finally {
      this.saving = false;
    }
  }

  backToPicker() {
    this.router.navigate(['/tabs', 'progress-note']);
  }
}
