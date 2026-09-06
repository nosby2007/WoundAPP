import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  IonTextarea,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';

import {
  EDUCATION_LEARNERS,
  EDUCATION_METHODS,
  EDUCATION_READINESS,
  EDUCATION_RESPONSES,
  EducationDraft,
  EducationLearner,
  EducationMethod,
  EducationReadiness,
  EducationResponse,
  EducationTopicOption,
  educationGaps,
  educationIsRecordable,
} from '../../shared/education';
import { EducationRow, EducationService } from '../../services/education.service';

/**
 * What the patient or their caregiver was taught, recorded while they are
 * still in the room.
 *
 * Teaching is the half of a home visit that leaves no trace unless somebody
 * writes it down, and the person who can write it down accurately is the one
 * who just did it. Recalled at a desk it becomes "wound care reviewed",
 * which documents nothing.
 *
 * The topics are the organization's own, read from its catalog. The four
 * structured fields -- who was taught, how ready they were, how it was
 * delivered, how they responded -- are the web app's, verbatim, so this
 * lands in the same chart with nothing to reconcile.
 */
@Component({
  selector: 'app-education',
  standalone: true,
  templateUrl: './education.page.html',
  styleUrls: ['./education.page.scss'],
  imports: [
    CommonModule, FormsModule,
    IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonItem,
    IonLabel, IonList, IonNote, IonSelect, IonSelectOption, IonSpinner,
    IonTextarea, IonTitle, IonToolbar,
  ],
})
export class EducationPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private education = inject(EducationService);
  private toastCtrl = inject(ToastController);

  patientId = this.route.snapshot.paramMap.get('patientId')!;

  /** Set when this was opened from a wound assessment. */
  woundId = this.route.snapshot.queryParamMap.get('woundId');
  woundLabel = this.route.snapshot.queryParamMap.get('woundLabel') || '';

  learnerOptions = EDUCATION_LEARNERS;
  readinessOptions = EDUCATION_READINESS;
  methodOptions = EDUCATION_METHODS;
  responseOptions = EDUCATION_RESPONSES;

  topics: EducationTopicOption[] = [];
  topicsLoaded = false;
  selectedTopicId: string | null = null;
  /** Typed instead of picked, for anything not in the catalog yet. */
  customTopic = '';

  learners: EducationLearner[] = [];
  readiness: EducationReadiness | null = null;
  method: EducationMethod[] = [];
  response: EducationResponse[] = [];
  notes = '';

  history: EducationRow[] = [];
  saving = false;
  errorMsg = '';

  ngOnInit(): void {
    void this.loadTopics();
    void this.loadHistory();
  }

  get selectedTopic(): EducationTopicOption | null {
    return this.topics.find((t) => t.id === this.selectedTopicId) ?? null;
  }

  get draft(): EducationDraft {
    const picked = this.selectedTopic;
    return {
      topic: picked ? picked.topic : this.customTopic,
      category: picked ? picked.category || null : null,
      learners: this.learners,
      readiness: this.readiness,
      method: this.method,
      response: this.response,
      woundId: this.woundId,
      notes: this.notes.trim() || null,
    };
  }

  get gaps(): string[] {
    return educationGaps(this.draft);
  }

  get canSave(): boolean {
    return !this.saving && educationIsRecordable(this.draft);
  }

  /**
   * Refusal is a complete record. A patient who refuses teaching has been
   * taught nothing, and the form must not push a nurse into claiming a
   * method or a response to get past it.
   */
  get refused(): boolean {
    return this.readiness === 'refuses';
  }

  onTopicChange(): void {
    if (this.selectedTopicId) this.customTopic = '';
  }

  private async loadTopics(): Promise<void> {
    try {
      this.topics = await this.education.listTopics();
    } catch (err) {
      console.warn('[EducationPage] topic catalog unavailable', err);
      this.topics = [];
    } finally {
      this.topicsLoaded = true;
    }
  }

  private async loadHistory(): Promise<void> {
    try {
      this.history = await this.education.list(this.patientId, 8);
    } catch (err) {
      // A history that will not load is not a reason to block recording.
      console.warn('[EducationPage] history unavailable', err);
    }
  }

  async save(): Promise<void> {
    if (!this.canSave) return;
    this.saving = true;
    this.errorMsg = '';

    try {
      await this.education.create(this.patientId, this.draft);
      const toast = await this.toastCtrl.create({
        message: 'Education recorded.',
        duration: 2200,
      });
      await toast.present();
      this.router.navigate(['/tabs', 'skin-wound', this.patientId, 'assessments']);
    } catch (err: any) {
      console.error('[EducationPage] save failed', err);
      this.errorMsg = err?.code === 'permission-denied'
        ? 'Your account is not allowed to record education on this patient.'
        : err?.message || 'Could not record the education.';
    } finally {
      this.saving = false;
    }
  }
}
