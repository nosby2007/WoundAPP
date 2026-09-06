import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';

import {
  BRADEN_ACTIVITY,
  BRADEN_FRICTION,
  BRADEN_MOBILITY,
  BRADEN_MOISTURE,
  BRADEN_NUTRITION,
  BRADEN_SENSORY,
  bradenIsComplete,
  bradenRiskClass,
  bradenRiskText,
  bradenTotal,
} from '../../shared/braden';
import { BradenRow, PatientAssessmentService } from '../../services/patient-assessment.service';

/**
 * The Braden Scale, taken at the bedside.
 *
 * It belongs on the phone for the same reason the wound assessment does: the
 * six subscales are observations of a patient who is in front of you --
 * whether they can feel pressure, whether the skin is moist, whether they can
 * shift their own weight. Answering them later from memory at a desk is
 * answering a different question.
 *
 * Writes into patients/{id}/assessments with kind 'braden', which is the
 * document the web app's Braden list already reads. Nothing new is invented:
 * the scoring, the thresholds and the six option lists are ported from that
 * app (see shared/braden.ts).
 */
@Component({
  selector: 'app-braden-form',
  standalone: true,
  templateUrl: './braden-form.page.html',
  styleUrls: ['./braden-form.page.scss'],
  imports: [
    CommonModule, ReactiveFormsModule,
    IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonItem,
    IonLabel, IonList, IonNote, IonSelect, IonSelectOption, IonSpinner,
    IonTitle, IonToolbar,
  ],
})
export class BradenFormPage implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private assessments = inject(PatientAssessmentService);
  private toastCtrl = inject(ToastController);

  patientId = this.route.snapshot.paramMap.get('patientId')!;

  sensoryOptions = BRADEN_SENSORY;
  moistureOptions = BRADEN_MOISTURE;
  activityOptions = BRADEN_ACTIVITY;
  mobilityOptions = BRADEN_MOBILITY;
  nutritionOptions = BRADEN_NUTRITION;
  frictionOptions = BRADEN_FRICTION;

  saving = false;
  errorMsg = '';
  history: BradenRow[] = [];
  historyLoaded = false;

  /**
   * Every subscale starts unanswered. A Braden that opens on "4: No
   * limitation" everywhere would score 23 -- minimal risk -- for a patient
   * nobody looked at.
   */
  form = this.fb.group({
    sensory: [null as number | null],
    moisture: [null as number | null],
    activity: [null as number | null],
    mobility: [null as number | null],
    nutrition: [null as number | null],
    friction: [null as number | null],
  });

  ngOnInit(): void {
    void this.loadHistory();
  }

  get subscales() {
    const v = this.form.getRawValue();
    return {
      sensory: v.sensory, moisture: v.moisture, activity: v.activity,
      mobility: v.mobility, nutrition: v.nutrition, friction: v.friction,
    };
  }

  /** Only shown once all six are answered -- a partial sum means nothing. */
  get complete(): boolean {
    return bradenIsComplete(this.subscales);
  }

  get total(): number {
    return bradenTotal(this.subscales);
  }

  get riskText(): string {
    return bradenRiskText(this.total);
  }

  get riskClass(): string {
    return bradenRiskClass(this.total);
  }

  private async loadHistory(): Promise<void> {
    try {
      this.history = await this.assessments.listBraden(this.patientId, 5);
    } catch (err) {
      // A history that will not load is not a reason to block a new score.
      console.warn('[BradenFormPage] history unavailable', err);
    } finally {
      this.historyLoaded = true;
    }
  }

  async save(): Promise<void> {
    if (!this.complete || this.saving) return;
    this.saving = true;
    this.errorMsg = '';

    try {
      await this.assessments.createBraden(this.patientId, this.subscales, new Date());
      const toast = await this.toastCtrl.create({
        message: `Braden ${this.total} — ${this.riskText}`,
        duration: 2500,
      });
      await toast.present();
      this.router.navigate(['/tabs', 'skin-wound', this.patientId, 'assessments']);
    } catch (err: any) {
      console.error('[BradenFormPage] save failed', err);
      this.errorMsg = err?.message || 'Could not save the Braden score.';
    } finally {
      this.saving = false;
    }
  }
}
