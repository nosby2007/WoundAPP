import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton, IonButton, IonButtons, IonCard, IonCardContent, IonContent,
  IonHeader, IonInput, IonItem, IonNote, IonSpinner, IonTextarea, IonTitle,
  IonToolbar, ToastController,
} from '@ionic/angular/standalone';

import { PatientAssessmentService } from '../../services/patient-assessment.service';
import { clinicalVisitQueryParams } from '../../shared/clinical-visit-link';

@Component({
  selector: 'app-general-clinical-assessment',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    IonBackButton, IonButton, IonButtons, IonCard, IonCardContent, IonContent,
    IonHeader, IonInput, IonItem, IonNote, IonSpinner, IonTextarea, IonTitle,
    IonToolbar,
  ],
  template: `
    <ion-header class="ion-no-border"><ion-toolbar>
      <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/patients"></ion-back-button></ion-buttons>
      <ion-title>Patient Assessment</ion-title>
    </ion-toolbar></ion-header>
    <ion-content>
      <div class="page">
        <section class="hero">
          <p class="eyebrow">VISIT ASSESSMENT</p>
          <h1>General clinical assessment</h1>
          <p>Document the patient-level findings for this encounter. Wound-specific findings stay in Wound Assessment.</p>
        </section>

        <form [formGroup]="form">
          <ion-card><ion-card-content>
            <ion-item lines="full"><ion-textarea formControlName="reasonForVisit" label="Reason / focus of visit" labelPlacement="stacked" autoGrow="true"></ion-textarea></ion-item>
            <ion-item lines="full"><ion-textarea formControlName="generalStatus" label="General clinical status" labelPlacement="stacked" autoGrow="true"></ion-textarea></ion-item>
            <ion-item lines="full"><ion-input type="number" min="0" max="10" formControlName="painScore" label="Pain score (0–10, if assessed)" labelPlacement="stacked"></ion-input></ion-item>
            <ion-item lines="full"><ion-textarea formControlName="functionalStatus" label="Functional / mobility status" labelPlacement="stacked" autoGrow="true"></ion-textarea></ion-item>
            <ion-item lines="full"><ion-textarea formControlName="nutritionHydration" label="Nutrition / hydration observations" labelPlacement="stacked" autoGrow="true"></ion-textarea></ion-item>
            <ion-item lines="full"><ion-textarea formControlName="medicationConcerns" label="Medication concerns reported / observed" labelPlacement="stacked" autoGrow="true"></ion-textarea></ion-item>
            <ion-item lines="full"><ion-textarea formControlName="safetyConcerns" label="Safety concerns" labelPlacement="stacked" autoGrow="true"></ion-textarea></ion-item>
            <ion-item lines="none"><ion-textarea formControlName="clinicalSummary" label="Clinical summary" labelPlacement="stacked" autoGrow="true" rows="4"></ion-textarea></ion-item>
            <ion-note>Only document findings actually assessed during this encounter.</ion-note>
          </ion-card-content></ion-card>

          <div class="error" *ngIf="errorMsg">{{ errorMsg }}</div>
          <ion-button expand="block" size="large" [disabled]="saving" (click)="save()">
            <ion-spinner *ngIf="saving" name="crescent"></ion-spinner>
            <span *ngIf="!saving">Save patient assessment</span>
          </ion-button>
        </form>
      </div>
    </ion-content>
  `,
  styles: [`
    .page{max-width:860px;margin:0 auto;padding:16px 14px 40px;background:#f4f7f9;min-height:100%}
    .hero{background:linear-gradient(145deg,#173f60,#0a7654);color:#fff;border-radius:24px;padding:22px;margin-bottom:14px}
    .hero h1{margin:5px 0;font-size:25px}.hero p{margin:0;opacity:.84}.eyebrow{font-size:10px;font-weight:800;letter-spacing:.14em}
    ion-card{border-radius:20px;box-shadow:0 5px 22px rgba(18,46,67,.06)}.error{padding:12px;border-radius:12px;background:#fff1f0;color:#9d2b25;margin:10px 0}
  `],
})
export class GeneralClinicalAssessmentPage {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly assessments = inject(PatientAssessmentService);
  private readonly toast = inject(ToastController);

  patientId = this.route.snapshot.paramMap.get('patientId') || '';
  appointmentId = this.route.snapshot.queryParamMap.get('appointmentId') || '';
  woundVisitId = this.route.snapshot.queryParamMap.get('woundVisitId') || '';
  woundId = this.route.snapshot.queryParamMap.get('woundId') || '';
  episodeId = this.route.snapshot.queryParamMap.get('episodeId') || '';

  saving = false;
  errorMsg = '';

  form = this.fb.group({
    reasonForVisit: [''],
    generalStatus: [''],
    painScore: [null as number | null],
    functionalStatus: [''],
    nutritionHydration: [''],
    medicationConcerns: [''],
    safetyConcerns: [''],
    clinicalSummary: [''],
  });

  async save(): Promise<void> {
    if (this.saving) return;
    this.saving = true;
    this.errorMsg = '';
    try {
      await this.assessments.createGeneralAssessment(
        this.patientId,
        this.form.getRawValue(),
        {
          visitId: this.woundVisitId || null,
          appointmentId: this.appointmentId || null,
          woundId: this.woundId || null,
          episodeId: this.episodeId || null,
          fieldEncounterVisitId: this.woundVisitId || null,
        }
      );
      const toast = await this.toast.create({ message: 'Patient assessment saved.', duration: 2200, color: 'success' });
      await toast.present();
      await this.router.navigate(['/tabs','skin-wound',this.patientId,'assessments'], {
        queryParams: clinicalVisitQueryParams({
          visitId: this.woundVisitId || null,
          appointmentId: this.appointmentId || null,
          woundId: this.woundId || null,
          episodeId: this.episodeId || null,
        }),
      });
    } catch (error: any) {
      this.errorMsg = error?.message || 'Patient assessment could not be saved.';
    } finally {
      this.saving = false;
    }
  }
}
