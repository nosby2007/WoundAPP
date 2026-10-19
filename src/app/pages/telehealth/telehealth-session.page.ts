import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  IonBadge, IonButton, IonCheckbox, IonContent, IonHeader, IonInput,
  IonTextarea, IonTitle, IonToolbar,
} from '@ionic/angular/standalone';
import {
  connect, createLocalAudioTrack, createLocalVideoTrack,
  LocalAudioTrack, LocalVideoTrack, RemoteTrack, Room,
} from 'twilio-video';
import { MobileTelehealthSession, TelehealthService } from '../../services/telehealth.service';
import { ClinicalDraftService } from '../../services/clinical-draft.service';
import { ProgressNoteService } from '../../services/progress-note.service';

@Component({
  standalone: true,
  selector: 'app-mobile-telehealth-session',
  imports: [
    CommonModule, FormsModule, IonBadge, IonButton, IonCheckbox, IonContent,
    IonHeader, IonInput, IonTextarea, IonTitle, IonToolbar,
  ],
  template: `
    <ion-header><ion-toolbar><ion-title>Telehealth · Field consultation</ion-title></ion-toolbar></ion-header>
    <ion-content><main>
      <p role="status">{{ status }}</p>
      <p role="alert" *ngIf="error">{{ error }}</p>

      <ng-container *ngIf="session as s">
        <div class="session-head">
          <div>
            <h1>{{ s.clinicalContext?.patientName || 'Patient consultation' }}</h1>
            <p>{{ s.clinicalContext?.woundLabel || 'Telehealth' }} · {{ s.deliveryMode === 'telehealth_audio' ? 'Audio-only' : 'Video' }}</p>
          </div>
          <ion-badge [color]="s.state === 'ended' ? 'medium' : s.state === 'in_progress' || s.state === 'waiting' ? 'success' : 'primary'">
            {{ s.state }}
          </ion-badge>
        </div>

        <section *ngIf="s.participant === 'facilitator' && (s.state === 'scheduled' || s.state === 'waiting') && s.consentStatus !== 'accepted'">
          <h2>Consent with the patient</h2>
          <ion-checkbox [(ngModel)]="present">The patient is physically present with me</ion-checkbox><br>
          <ion-checkbox [(ngModel)]="consented">Patient identity verified and verbal consent obtained</ion-checkbox>
          <ion-input label="Patient location now" labelPlacement="stacked" [(ngModel)]="location" maxlength="160"></ion-input>
          <ion-textarea label="Consent evidence" labelPlacement="stacked" [(ngModel)]="evidence" maxlength="1000"></ion-textarea>
          <ion-button [disabled]="busy || !present || !consented || location.trim().length < 3 || evidence.trim().length < 12"
            (click)="recordConsent()">Record facilitated consent</ion-button>
        </section>

        <div class="videos call-stage" [class.front-camera]="cameraFacing === 'user'" *ngIf="s.state !== 'ended' && s.state !== 'cancelled' && s.state !== 'failed'">
          <section class="self-tile"><h2>You</h2><div #local class="media"></div></section>
          <section class="remote-tile"><h2>NP / other participant</h2><div #remote class="media"></div></section>
        </div>

        <div class="video-actions call-controls">
          <ion-button *ngIf="!connected && s.state !== 'ended'" [disabled]="busy || s.consentStatus !== 'accepted' || !isOpen" (click)="join()">Join video consultation</ion-button>
          <ion-button *ngIf="connected" (click)="mute()">{{ audioEnabled ? 'Mute' : 'Unmute' }}</ion-button>
          <ion-button *ngIf="connected" (click)="camera()">{{ videoEnabled ? 'Camera off' : 'Camera on' }}</ion-button>
          <ion-button *ngIf="connected" [disabled]="switchingCamera" (click)="flipCamera()">Flip camera</ion-button>
          <ion-button *ngIf="connected" color="danger" (click)="leave()">Leave video</ion-button>
          <ion-button *ngIf="s.participant === 'facilitator' && (s.state === 'scheduled' || s.state === 'waiting')" color="danger" [disabled]="busy" (click)="cancel()">Cancel consultation</ion-button>
          <ion-button fill="outline" [disabled]="busy" (click)="refresh()">Refresh session</ion-button>
        </div>

        <section class="provider-note" *ngIf="s.participant === 'provider' && (s.state === 'in_progress' || s.state === 'ended')">
          <div class="note-head">
            <div>
              <p class="eyebrow">PROVIDER DOCUMENTATION</p>
              <h2>Telehealth clinical note</h2>
              <p>You may complete this note during the consultation or return after the encounter ends.</p>
            </div>
            <ion-badge [color]="s.draftNoteId ? 'success' : 'medium'">{{ s.draftNoteId ? 'Chart draft linked' : 'Autosaved draft' }}</ion-badge>
          </div>

          <ion-input label="Participants and roles" labelPlacement="stacked"
            [(ngModel)]="participants" (ionInput)="noteChanged()"></ion-input>
          <ion-textarea label="Patient identity verification" labelPlacement="stacked"
            [(ngModel)]="identityVerification" (ionInput)="noteChanged()"></ion-textarea>
          <ion-textarea label="Remote observations and patient-reported findings" labelPlacement="stacked"
            [(ngModel)]="observedFindings" (ionInput)="noteChanged()"></ion-textarea>
          <ion-textarea label="Remote examination limitations" labelPlacement="stacked"
            [(ngModel)]="examLimitations" (ionInput)="noteChanged()"></ion-textarea>
          <ion-textarea label="Assessment and plan" labelPlacement="stacked"
            [(ngModel)]="assessmentAndPlan" (ionInput)="noteChanged()"></ion-textarea>
          <ion-textarea label="Follow-up and return precautions" labelPlacement="stacked"
            [(ngModel)]="followUpAndPrecautions" (ionInput)="noteChanged()"></ion-textarea>
          <ion-textarea label="Additional clinical narrative" labelPlacement="stacked"
            [(ngModel)]="noteDetails" (ionInput)="noteChanged()"></ion-textarea>

          <p class="draft-state">{{ noteDraftStatus }}</p>
          <ion-button expand="block" color="success" [disabled]="busy || !canSaveNote" (click)="saveProviderDraft()">
            {{ s.draftNoteId ? 'Update note draft' : 'Save note draft to chart' }}
          </ion-button>
          <p class="small">Saving a draft does not sign the note or create a claim. Final signature remains a separate clinician action.</p>
        </section>
      </ng-container>

      <p class="small">Leaving video does not complete a physical visit or create a claim. Camera and microphone tracks stop when the page is left.</p>
    </main></ion-content>`,
  styles: [`
    main{padding:18px;max-width:950px;margin:auto}.session-head,.note-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}
    .videos{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}.media{background:#10251d;min-height:180px;overflow:hidden}
    p[role=alert]{color:var(--ion-color-danger)}ion-checkbox{margin:10px 0}.video-actions{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}
    .call-stage{position:relative;display:block;width:100%;margin:12px auto 0;background:#101b21;border-radius:22px;overflow:hidden;aspect-ratio:3/4;max-height:min(64dvh,650px)}
    .call-stage .self-tile{position:absolute;inset:0;display:flex;flex-direction:column;min-width:0;background:#101b21}
    .call-stage .self-tile .media{flex:1;min-height:0;width:100%;background:#101b21}
    .call-stage .remote-tile{position:absolute;right:12px;top:12px;width:27%;max-width:155px;z-index:2;display:flex;flex-direction:column;background:#263942;border:2px solid #ffffff80;border-radius:16px;overflow:hidden;box-shadow:0 6px 22px #0006}
    .call-stage .remote-tile .media{min-height:100px;aspect-ratio:3/4}
    .call-stage h2{color:white;font-size:12px;margin:0;padding:7px 10px;background:#10252acc}
    .call-stage .media video{display:block;width:100%;height:100%;object-fit:contain;object-position:center center}
    .call-stage.front-camera .self-tile .media video{transform:scaleX(-1)}
    .call-controls{justify-content:center;align-items:center;padding:12px;margin:12px 0 90px;border-radius:22px;background:#172b32;gap:8px}
    .call-controls ion-button{--border-radius:24px;font-size:12px;min-height:44px}
    main{padding-bottom:calc(120px + env(safe-area-inset-bottom,0px))}
    @media(min-width:700px){.call-stage{aspect-ratio:16/9;max-height:620px}.call-stage .remote-tile{width:22%}}
    .provider-note{margin-top:24px;padding:18px;border-radius:18px;background:var(--ion-color-light)}.provider-note ion-input,.provider-note ion-textarea{margin:10px 0}
    .eyebrow{font-size:10px;letter-spacing:.14em;font-weight:800;color:var(--ion-color-success);margin:0}.draft-state,.small{font-size:12px;color:var(--ion-color-medium)}
  `],
})
export class TelehealthSessionPage implements OnDestroy {
  @ViewChild('local') local?: ElementRef<HTMLElement>;
  @ViewChild('remote') remote?: ElementRef<HTMLElement>;

  session: MobileTelehealthSession | null = null;
  busy = false;
  status = '';
  error = '';
  present = false;
  consented = false;
  location = '';
  evidence = '';
  connected = false;
  audioEnabled = true;
  videoEnabled = true;
  switchingCamera = false;
  private cameraFacing: 'user' | 'environment' = 'user';

  participants = '';
  identityVerification = '';
  observedFindings = '';
  examLimitations = '';
  assessmentAndPlan = '';
  followUpAndPrecautions = '';
  noteDetails = '';
  noteDraftStatus = '';

  private room: Room | null = null;
  private audio: LocalAudioTrack | null = null;
  private video: LocalVideoTrack | null = null;
  private timer?: ReturnType<typeof setInterval>;
  private noteTimer?: ReturnType<typeof setTimeout>;
  private generation = 0;
  private appointmentId: string;
  private draftRestoredFor = '';

  constructor(
    private service: TelehealthService,
    private drafts: ClinicalDraftService,
    private notes: ProgressNoteService,
    route: ActivatedRoute,
  ) {
    this.appointmentId = route.snapshot.paramMap.get('appointmentId') || '';
  }

  get isOpen(): boolean {
    return !!this.session && ['waiting', 'in_progress'].includes(this.session.state);
  }

  get canSaveNote(): boolean {
    if (!this.session || this.session.participant !== 'provider') return false;
    return [
      this.participants,
      this.identityVerification,
      this.observedFindings,
      this.examLimitations,
      this.assessmentAndPlan,
      this.followUpAndPrecautions,
    ].every((value) => value.trim().length > 0);
  }

  ionViewWillEnter(): void {
    this.stopPolling();
    void this.refresh();
    this.timer = setInterval(() => {
      if (document.visibilityState !== 'hidden') void this.refresh();
    }, 12000);
  }

  ionViewWillLeave(): void {
    this.stopPolling();
    void this.persistProviderDraft();
    this.leave();
  }

  ngOnDestroy(): void {
    this.stopPolling();
    if (this.noteTimer) clearTimeout(this.noteTimer);
    void this.persistProviderDraft();
    this.leave();
  }

  @HostListener('document:visibilitychange')
  visibility(): void {
    if (document.visibilityState === 'hidden') {
      void this.persistProviderDraft();
      this.leave();
    }
  }

  async refresh(): Promise<void> {
    if (this.busy || !this.appointmentId) return;
    this.busy = true;
    try {
      this.session = await this.service.session(this.appointmentId);
      if (['ended', 'cancelled', 'failed'].includes(this.session.state)) {
        this.leave();
        this.status = this.session.state === 'ended'
          ? 'Consultation completed. Provider documentation remains available below.'
          : 'Consultation closed.';
      }
      await this.restoreProviderDraft();
    } catch (e: any) {
      this.leave();
      this.error = e?.message || 'Unable to verify session access.';
    } finally {
      this.busy = false;
    }
  }

  async recordConsent(): Promise<void> {
    if (!this.session || this.busy || !this.present || !this.consented ||
        this.location.trim().length < 3 || this.evidence.trim().length < 12) return;
    this.busy = true;
    this.error = '';
    try {
      this.session = await this.service.consent({
        sessionId: this.session.id,
        consentVersion: this.session.consentVersion,
        patientLocation: this.location.trim(),
        evidenceNote: this.evidence.trim(),
        patientPresent: true,
        consentConfirmed: true,
      });
      this.status = 'Consent recorded. Join and notify the assigned NP.';
    } catch (e: any) {
      this.error = e?.message || 'Consent failed.';
    } finally {
      this.busy = false;
    }
  }

  async join(): Promise<void> {
    if (!this.session || this.busy || this.connected || !this.isOpen || this.session.consentStatus !== 'accepted') return;
    this.busy = true;
    this.error = '';
    const generation = ++this.generation;
    try {
      this.status = 'Requesting secure video access…';
      const grant = await this.service.videoToken(this.session.id);
      if (generation !== this.generation) return;
      this.status = 'Allow camera and microphone access…';
      const audio = await createLocalAudioTrack();
      if (generation !== this.generation) { audio.stop(); return; }
      this.audio = audio;
      const video = await createLocalVideoTrack({width: 640, facingMode: this.cameraFacing});
      if (generation !== this.generation) { video.stop(); return; }
      this.video = video;
      this.local?.nativeElement.replaceChildren(video.attach());
      this.status = 'Connecting…';
      const room = await connect(grant.token, {name: grant.room, tracks: [audio, video]});
      if (generation !== this.generation) { room.disconnect(); return; }
      this.room = room;
      this.connected = true;
      this.audioEnabled = true;
      this.videoEnabled = true;
      room.participants.forEach(p => p.tracks.forEach(pub => { if (pub.track) this.attach(pub.track); }));
      room.on('trackSubscribed', track => this.attach(track));
      room.on('trackUnsubscribed', track => { if (track.kind !== 'data') track.detach().forEach(el => el.remove()); });
      room.on('disconnected', () => {
        this.room = null;
        this.leave();
        this.status = 'Video disconnected.';
      });
      this.status = 'Connected.';
    } catch (e: any) {
      this.leave();
      this.error = e?.message || 'Video failed. Verify device permissions and retry.';
    } finally {
      this.busy = false;
    }
  }

  mute(): void {
    this.audioEnabled ? this.audio?.disable() : this.audio?.enable();
    this.audioEnabled = !this.audioEnabled;
  }

  camera(): void {
    this.videoEnabled ? this.video?.disable() : this.video?.enable();
    this.videoEnabled = !this.videoEnabled;
  }

  async flipCamera(): Promise<void> {
    if (!this.room || !this.video || this.switchingCamera) return;
    this.switchingCamera = true;
    const previous = this.video;
    const nextFacing = this.cameraFacing === 'user' ? 'environment' : 'user';
    try {
      // Acquire the new camera before unpublishing the old track; keep the call connected.
      const next = await createLocalVideoTrack({width: 640, facingMode: nextFacing});
      if (!this.room || this.video !== previous) { next.stop(); return; }
      const publication = this.room.localParticipant.videoTracks.values().next().value;
      if (publication) this.room.localParticipant.unpublishTrack(previous);
      try {
        await this.room.localParticipant.publishTrack(next);
      } catch (error) {
        next.stop();
        await this.room.localParticipant.publishTrack(previous);
        throw error;
      }
      previous.detach().forEach(element => element.remove());
      previous.stop();
      this.video = next;
      this.cameraFacing = nextFacing;
      this.local?.nativeElement.replaceChildren(next.attach());
      if (!this.videoEnabled) next.disable();
    } catch (error: any) {
      this.error = error?.message || 'Camera switch failed; your existing camera remains available.';
    } finally {
      this.switchingCamera = false;
    }
  }

  leave(): void {
    this.generation++;
    const room = this.room;
    this.room = null;
    room?.disconnect();
    this.audio?.stop();
    this.video?.stop();
    this.audio = null;
    this.video = null;
    this.connected = false;
    this.local?.nativeElement.replaceChildren();
    this.remote?.nativeElement.replaceChildren();
  }

  async cancel(): Promise<void> {
    if (!this.session || this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      this.session = await this.service.cancel(this.session);
      this.leave();
    } catch (e: any) {
      this.leave();
      this.error = e?.message || 'Cancellation failed; refresh and retry.';
    } finally {
      this.busy = false;
    }
  }

  noteChanged(): void {
    if (this.noteTimer) clearTimeout(this.noteTimer);
    this.noteTimer = setTimeout(() => void this.persistProviderDraft(), 900);
  }

  async saveProviderDraft(): Promise<void> {
    if (!this.session || !this.canSaveNote || this.busy) return;
    const patientId = this.session.clinicalContext?.patientId || '';
    if (!patientId) {
      this.error = 'Patient context is missing from this consultation.';
      return;
    }

    this.busy = true;
    this.error = '';
    try {
      const documentation = this.telehealthDocumentation();
      const details = this.noteNarrative();

      let noteId = this.session.draftNoteId || '';
      if (noteId) {
        await this.notes.updateDraft(patientId, noteId, details, documentation);
      } else {
        noteId = await this.notes.create(
          patientId,
          details,
          null,
          null,
          {
            visitId: this.session.appointmentId,
            appointmentId: this.session.appointmentId,
            woundId: this.session.clinicalContext?.woundId || null,
            fieldEncounterVisitId: null,
          },
          {
            telehealthSessionId: this.session.id,
            appointmentId: this.session.appointmentId,
            deliveryMode: this.session.deliveryMode,
            serviceDateIso: this.session.clinicalContext?.serviceDateIso || null,
            documentation,
          },
        );
        await this.service.registerDraftNote(this.session.id, noteId);
      }

      await this.drafts.clear(this.noteDraftKey()).catch(() => undefined);
      this.noteDraftStatus = 'Draft saved to the patient chart.';
      await this.refresh();
    } catch (e: any) {
      this.error = e?.message || 'Telehealth note draft could not be saved.';
    } finally {
      this.busy = false;
    }
  }

  private async restoreProviderDraft(): Promise<void> {
    const session = this.session;
    const patientId = session?.clinicalContext?.patientId || '';
    if (!session || session.participant !== 'provider' || !patientId || this.draftRestoredFor === session.id) return;
    this.draftRestoredFor = session.id;

    try {
      if (session.draftNoteId) {
        const existing = await this.notes.getDraft(patientId, session.draftNoteId);
        if (existing) {
          this.noteDetails = existing.details || '';
          this.applyDocumentation(existing.telehealthDocumentation || {});
          this.noteDraftStatus = 'Existing chart draft restored.';
          return;
        }
      }
      const saved = await this.drafts.load<any>(this.noteDraftKey());
      if (saved?.payload) {
        this.applyDraftPayload(saved.payload);
        this.noteDraftStatus = saved.updatedAt
          ? `Autosaved draft restored from ${new Date(saved.updatedAt).toLocaleString()}`
          : 'Autosaved draft restored.';
      }
    } catch {
      this.noteDraftStatus = 'Draft recovery unavailable; current note remains editable.';
    }
  }

  private async persistProviderDraft(): Promise<void> {
    const session = this.session;
    if (!session || session.participant !== 'provider' || !session.clinicalContext?.patientId) return;
    const payload = {
      participants: this.participants,
      identityVerification: this.identityVerification,
      observedFindings: this.observedFindings,
      examLimitations: this.examLimitations,
      assessmentAndPlan: this.assessmentAndPlan,
      followUpAndPrecautions: this.followUpAndPrecautions,
      noteDetails: this.noteDetails,
    };
    if (!Object.values(payload).some((value) => String(value || '').trim())) return;
    try {
      await this.drafts.save(this.noteDraftKey(), payload);
      this.noteDraftStatus = 'Draft autosaved.';
    } catch {
      this.noteDraftStatus = 'Draft not synced yet.';
    }
  }

  private noteDraftKey() {
    return {
      formKind: 'telehealth_note' as const,
      patientId: this.session?.clinicalContext?.patientId || '',
      contextKey: this.appointmentId,
    };
  }

  private telehealthDocumentation() {
    return {
      modality: this.session?.deliveryMode === 'telehealth_audio' ? 'Audio-only' as const : 'Video' as const,
      consent: this.session?.consentStatus === 'accepted' ? 'Accepted' : String(this.session?.consentStatus || ''),
      patientLocation: String(this.session?.clinicalContext?.patientReportedLocation || this.location || ''),
      participants: this.participants.trim(),
      identityVerification: this.identityVerification.trim(),
      observedFindings: this.observedFindings.trim(),
      examLimitations: this.examLimitations.trim(),
      assessmentAndPlan: this.assessmentAndPlan.trim(),
      followUpAndPrecautions: this.followUpAndPrecautions.trim(),
    };
  }

  private noteNarrative(): string {
    const parts = [
      this.noteDetails.trim(),
      this.observedFindings.trim() ? `Remote findings: ${this.observedFindings.trim()}` : '',
      this.assessmentAndPlan.trim() ? `Assessment/plan: ${this.assessmentAndPlan.trim()}` : '',
      this.followUpAndPrecautions.trim() ? `Follow-up/precautions: ${this.followUpAndPrecautions.trim()}` : '',
    ].filter(Boolean);
    return parts.join('\n\n');
  }

  private applyDocumentation(value: any): void {
    this.participants = String(value?.participants || this.participants || '');
    this.identityVerification = String(value?.identityVerification || this.identityVerification || '');
    this.observedFindings = String(value?.observedFindings || this.observedFindings || '');
    this.examLimitations = String(value?.examLimitations || this.examLimitations || '');
    this.assessmentAndPlan = String(value?.assessmentAndPlan || this.assessmentAndPlan || '');
    this.followUpAndPrecautions = String(value?.followUpAndPrecautions || this.followUpAndPrecautions || '');
  }

  private applyDraftPayload(value: any): void {
    this.participants = String(value?.participants || '');
    this.identityVerification = String(value?.identityVerification || '');
    this.observedFindings = String(value?.observedFindings || '');
    this.examLimitations = String(value?.examLimitations || '');
    this.assessmentAndPlan = String(value?.assessmentAndPlan || '');
    this.followUpAndPrecautions = String(value?.followUpAndPrecautions || '');
    this.noteDetails = String(value?.noteDetails || '');
  }

  private attach(track: RemoteTrack): void {
    if (track.kind === 'data') return;
    const el = track.attach();
    el.style.width = '100%';
    this.remote?.nativeElement.appendChild(el);
  }

  private stopPolling(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
}