import { Component, OnDestroy, OnInit, inject } from '@angular/core';
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
import { ClinicalDraftService } from '../../services/clinical-draft.service';
import { clinicalVisitQueryParams } from '../../shared/clinical-visit-link';

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
export class EducationPage implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private education = inject(EducationService);
  private toastCtrl = inject(ToastController);
  private drafts = inject(ClinicalDraftService);

  patientId = this.route.snapshot.paramMap.get('patientId')!;
  appointmentId = this.route.snapshot.queryParamMap.get('appointmentId') || '';
  woundVisitId = this.route.snapshot.queryParamMap.get('woundVisitId') || '';
  episodeId = this.route.snapshot.queryParamMap.get('episodeId') || '';

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
  draftStatus = '';
  private draftTimer?: ReturnType<typeof setTimeout>;
  editorOpen = false; loading = true; historyError = ''; reviewMessage = ''; draftAvailable = false;
  previousEducationId: string | null = null;
  private draftWrites: Promise<void> = Promise.resolve();

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadTopics(), this.loadHistory()]);
    await this.restoreDraft();
    this.loading = false;
  }

  ngOnDestroy(): void {
    if (this.draftTimer) clearTimeout(this.draftTimer);
    void this.persistDraft();
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
    return this.editorOpen && !this.loading && !this.saving && educationIsRecordable(this.draft);
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
    this.scheduleDraft();
  }

  scheduleDraft(): void {
    if (!this.editorOpen || this.loading || this.saving) return;
    if (this.draftTimer) clearTimeout(this.draftTimer);
    this.draftTimer = setTimeout(() => void this.persistDraft(), 900);
  }

  private draftKey() {
    return {
      formKind: 'education' as const,
      patientId: this.patientId,
      contextKey: [
        this.woundVisitId || this.appointmentId || 'no-visit',
        this.woundId || 'no-wound',
      ].join(':'),
    };
  }

  private async restoreDraft(): Promise<void> {
    try {
      const saved = await this.drafts.load<any>(this.draftKey());
      const value = saved?.payload;
      if (!value) return;
      this.selectedTopicId = value.selectedTopicId || null;
      this.customTopic = String(value.customTopic || '');
      this.learners = Array.isArray(value.learners) ? value.learners : [];
      this.readiness = value.readiness || null;
      this.method = Array.isArray(value.method) ? value.method : [];
      this.response = Array.isArray(value.response) ? value.response : [];
      this.notes = String(value.notes || '');
      this.previousEducationId = value.previousEducationId || null;
      this.draftAvailable = true;
      this.draftStatus = saved?.updatedAt
        ? `Draft restored from ${new Date(saved.updatedAt).toLocaleString()}`
        : 'Draft restored';
    } catch {
      // Draft recovery must not block bedside education documentation.
    }
  }

  private async persistDraft(): Promise<void> {
    if (!this.patientId || !this.editorOpen || this.loading || this.saving) return;
    const payload = {
      selectedTopicId: this.selectedTopicId,
      customTopic: this.customTopic,
      learners: this.learners,
      readiness: this.readiness,
      method: this.method,
      response: this.response,
      notes: this.notes,
      previousEducationId: this.previousEducationId,
    };
    const hasContent = Object.values(payload).some((value) =>
      Array.isArray(value) ? value.length > 0 : String(value ?? '').trim().length > 0
    );
    if (!hasContent) return;
    try {
      const snapshot = JSON.parse(JSON.stringify(payload));
      this.draftWrites = this.draftWrites.catch(() => undefined).then(() => this.drafts.save(this.draftKey(), snapshot));
      await this.draftWrites;
      this.draftStatus = 'Draft autosaved.';
    } catch {
      this.draftStatus = 'Draft not synced yet.';
    }
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
      this.history = await this.education.list(this.patientId, 50, { woundId: this.woundId, episodeId: this.episodeId });
    } catch (err) {
      // A history that will not load is not a reason to block recording.
      console.warn('[EducationPage] history unavailable', err);
      this.historyError = 'Previous education could not be loaded. Do not assume that no education exists.';
    }
  }

  async save(): Promise<void> {
    if (!this.canSave) return;
    this.saving = true;
    this.errorMsg = '';

    try {
      if (this.draftTimer) clearTimeout(this.draftTimer);
      await this.draftWrites.catch(() => undefined);
      await this.education.create(this.patientId, this.draft, {
        visitId: this.woundVisitId || null,
        appointmentId: this.appointmentId || null,
        woundId: this.woundId || null,
        episodeId: this.episodeId || null,
        fieldEncounterVisitId: this.woundVisitId || null,
      }, this.previousEducationId);
      this.editorOpen = false; this.draftAvailable = false;
      await this.drafts.clear(this.draftKey()).catch(() => undefined);
      this.draftStatus = '';
      const toast = await this.toastCtrl.create({
        message: 'Education recorded.',
        duration: 2200,
      });
      await toast.present();
      this.router.navigate(['/tabs', 'skin-wound', this.patientId, 'assessments'], {
        queryParams: clinicalVisitQueryParams({
          visitId: this.woundVisitId || null,
          appointmentId: this.appointmentId || null,
          woundId: this.woundId || null,
          episodeId: this.episodeId || null,
        }),
      });
    } catch (err: any) {
      console.error('[EducationPage] save failed', err);
      this.errorMsg = err?.code === 'permission-denied'
        ? 'Your account is not allowed to record education on this patient.'
        : err?.message || 'Could not record the education.';
    } finally {
      this.saving = false;
    }
  }

  beginSession(row?: EducationRow): void {
    if (this.loading || this.saving) return;
    // Reuse the topic only, never the prior encounter's learner response or delivery facts.
    this.selectedTopicId = null; this.customTopic = row?.topic || '';
    this.previousEducationId = row?.id || null;
    this.learners = []; this.readiness = null; this.method = []; this.response = []; this.notes = '';
    this.errorMsg = ''; this.reviewMessage = ''; this.draftStatus = ''; this.draftAvailable = false;
    this.editorOpen = true;
  }
  async keepHistory(): Promise<void> {
    if (this.loading || this.saving || this.editorOpen) return;
    this.saving = true;
    try {
      await this.education.reviewHistory(this.patientId, { woundId: this.woundId, episodeId: this.episodeId,
        visitId: this.woundVisitId, appointmentId: this.appointmentId });
      this.reviewMessage = 'Previous education retained. No new teaching session recorded.';
    } catch (e: any) { this.reviewMessage = e?.message || 'History review could not be saved.'; }
    finally { this.saving = false; }
  }
  async cancelSession(): Promise<void> {
    this.editorOpen = false; this.draftAvailable = false;
    if (this.draftTimer) clearTimeout(this.draftTimer);
    await this.draftWrites.catch(() => undefined);
    await this.drafts.clear(this.draftKey()).catch(() => { this.errorMsg = 'Session cancelled, but the recovery draft could not be cleared.'; });
  }
}
