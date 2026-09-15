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
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';

import {
  WOUND_NOTE_REASONS,
  WOUND_NOTE_RECOMMENDATIONS,
  WoundNoteVisitKind,
  buildWoundProgressNote,
  defaultReasonForConsult,
  defaultRecommendation,
} from '../../shared/wound-progress-note';
import { WoundNoteSnapshot, WoundProgressNoteService } from '../../services/wound-progress-note.service';
import { ProgressNoteService, ProgressNoteVoiceProvenance } from '../../services/progress-note.service';
import { MobileVoiceNoteService } from '../../services/mobile-voice-note.service';
import { clinicalVisitQueryParams } from '../../shared/clinical-visit-link';

/**
 * The wound progress note, on the way out of the visit.
 *
 * Everything clinical in it has already been recorded: the wounds were
 * measured, the dressings chosen, the Braden scored, the caregiver taught.
 * Retyping that into a note is how an hour of documentation gets added to a
 * visit, and how the note ends up disagreeing with the chart it was copied
 * from.
 *
 * So the note is assembled and shown. Two things are the clinician's own and
 * are asked for -- why the consult happened, and what the recommendation is
 * -- and the text stays editable, because a generated note that cannot be
 * corrected is a generated note nobody signs.
 *
 * It is filed as an ordinary provider note, so it lands in the chart the
 * providers already read and in the billing supporting-document picker.
 */
@Component({
  selector: 'app-wound-note',
  standalone: true,
  templateUrl: './wound-note.page.html',
  styleUrls: ['./wound-note.page.scss'],
  imports: [
    CommonModule, FormsModule,
    IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonItem,
    IonLabel, IonList, IonNote, IonSegment, IonSegmentButton, IonSpinner,
    IonTextarea, IonTitle, IonToolbar,
  ],
})
export class WoundNotePage implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private builder = inject(WoundProgressNoteService);
  private notes = inject(ProgressNoteService);
  private toastCtrl = inject(ToastController);
  readonly voice = inject(MobileVoiceNoteService);

  patientId = this.route.snapshot.paramMap.get('patientId')!;
  appointmentId = this.route.snapshot.queryParamMap.get('appointmentId') || '';
  woundVisitId = this.route.snapshot.queryParamMap.get('woundVisitId') || '';
  woundId = this.route.snapshot.queryParamMap.get('woundId') || '';
  episodeId = this.route.snapshot.queryParamMap.get('episodeId') || '';

  reasons = WOUND_NOTE_REASONS;
  recommendations = WOUND_NOTE_RECOMMENDATIONS;

  snapshot: WoundNoteSnapshot | null = null;
  loading = true;
  errorMsg = '';
  saving = false;

  visitKind: WoundNoteVisitKind = 'admission';
  reasonForConsult = '';
  recommendation = '';

  /**
   * The rendered note, editable.
   *
   * Regenerated whenever the two choices change, UNLESS the clinician has
   * typed into it. Overwriting their correction because they then changed a
   * dropdown would lose work silently, which is the fastest way to make a
   * generated note untrusted.
   */
  noteText = '';
  edited = false;
  voiceRecording = false;
  voiceBusy = false;
  voiceDraft = '';
  voiceTranscript = '';
  voiceElapsedSeconds = 0;
  acceptedVoiceProvenance: ProgressNoteVoiceProvenance | null = null;
  private voiceTimer: ReturnType<typeof setInterval> | null = null;

  async ngOnInit(): Promise<void> {
    try {
      this.snapshot = await this.builder.gather(this.patientId, new Date(), {
        visitId: this.woundVisitId || null,
        appointmentId: this.appointmentId || null,
        woundId: this.woundId || null,
        episodeId: this.episodeId || null,
        fieldEncounterVisitId: this.woundVisitId || null,
      });
      this.visitKind = this.snapshot.visitKind;
      this.reasonForConsult = this.snapshot.reasonForConsult;
      this.recommendation = this.snapshot.recommendation;
      this.regenerate();
    } catch (err: any) {
      console.error('[WoundNotePage] could not assemble the note', err);
      this.errorMsg = 'Could not read this visit\'s records. Try again.';
    } finally {
      this.loading = false;
    }
  }

  ngOnDestroy(): void {
    this.cancelVoice();
  }

  get voiceElapsedLabel(): string {
    const minutes = Math.floor(this.voiceElapsedSeconds / 60);
    const seconds = this.voiceElapsedSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  async startVoice(): Promise<void> {
    if (this.voiceBusy || this.voiceRecording) return;
    try {
      await this.voice.start();
      this.voiceDraft = '';
      this.voiceTranscript = '';
      this.voiceElapsedSeconds = 0;
      this.voiceRecording = true;
      this.voiceTimer = setInterval(() => {
        this.voiceElapsedSeconds += 1;
        if (this.voiceElapsedSeconds >= 120) void this.stopVoice();
      }, 1000);
    } catch (error: any) {
      this.errorMsg = error?.message || 'Unable to start voice dictation.';
    }
  }

  async stopVoice(): Promise<void> {
    if (!this.voiceRecording || this.voiceBusy) return;
    this.clearVoiceTimer();
    this.voiceRecording = false;
    this.voiceBusy = true;
    this.errorMsg = '';
    try {
      const result = await this.voice.stopAndCreateDraft();
      this.voiceTranscript = result.transcript;
      this.voiceDraft = result.draft;
      this.acceptedVoiceProvenance = result.provenance;
    } catch (error: any) {
      this.errorMsg = error?.message || 'Unable to create a note draft from voice.';
    } finally {
      this.voiceBusy = false;
    }
  }

  acceptVoiceDraft(): void {
    const draft = this.voiceDraft.trim();
    if (!draft) return;
    const separator = this.noteText.trim() ? '\n\nClinician narrative:\n' : '';
    this.noteText = this.noteText.trimEnd() + separator + draft;
    this.edited = true;
    this.voiceDraft = '';
    this.voiceTranscript = '';
  }

  discardVoiceDraft(): void {
    this.voiceDraft = '';
    this.voiceTranscript = '';
    this.acceptedVoiceProvenance = null;
  }

  cancelVoice(): void {
    this.clearVoiceTimer();
    this.voice.cancel();
    this.voiceRecording = false;
    this.voiceBusy = false;
    this.voiceElapsedSeconds = 0;
  }

  private clearVoiceTimer(): void {
    if (this.voiceTimer) clearInterval(this.voiceTimer);
    this.voiceTimer = null;
  }

  get woundCount(): number {
    return this.snapshot?.wounds.length ?? 0;
  }

  onVisitKindChange(): void {
    this.reasonForConsult = defaultReasonForConsult(this.visitKind);
    this.recommendation = defaultRecommendation(this.visitKind);
    this.regenerate();
  }

  onChoiceChange(): void {
    this.regenerate();
  }

  onNoteEdited(): void {
    this.edited = true;
  }

  /** Throws the clinician's edits away, on purpose and only when asked. */
  rebuild(): void {
    this.edited = false;
    this.regenerate(true);
  }

  private regenerate(force = false): void {
    if (!this.snapshot) return;
    if (this.edited && !force) return;

    this.noteText = buildWoundProgressNote({
      ...this.snapshot,
      visitKind: this.visitKind,
      reasonForConsult: this.reasonForConsult,
      recommendation: this.recommendation,
    });
  }

  async save(): Promise<void> {
    if (this.saving || !this.noteText.trim()) return;
    if (this.voiceDraft.trim()) {
      this.errorMsg = 'Review the pending voice draft: add it to the note or discard it before filing.';
      return;
    }
    this.saving = true;
    this.errorMsg = '';

    try {
      await this.notes.create(
        this.patientId,
        this.noteText,
        null,
        this.acceptedVoiceProvenance,
        {
          visitId: this.woundVisitId || null,
          appointmentId: this.appointmentId || null,
          woundId: this.woundId || null,
          episodeId: this.episodeId || null,
          fieldEncounterVisitId: this.woundVisitId || null,
        }
      );
      const toast = await this.toastCtrl.create({
        message: 'Wound progress note filed.',
        duration: 2400,
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
      console.error('[WoundNotePage] save failed', err);
      this.errorMsg = err?.code === 'permission-denied'
        ? 'Your account is not allowed to write notes on this patient.'
        : 'Could not file the note. It is still on screen -- try again.';
    } finally {
      this.saving = false;
    }
  }
}
