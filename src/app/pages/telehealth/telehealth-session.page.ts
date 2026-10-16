import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  IonBadge, IonButton, IonCheckbox, IonContent, IonHeader, IonIcon, IonInput,
  IonTextarea, IonTitle, IonToolbar,
} from '@ionic/angular/standalone';
import {
  connect, createLocalAudioTrack, createLocalVideoTrack,
  LocalAudioTrack, LocalVideoTrack, RemoteTrack, Room,
} from 'twilio-video';
import { addIcons } from 'ionicons';
import {
  callOutline,
  cameraReverseOutline,
  micOffOutline,
  micOutline,
  videocamOffOutline,
  videocamOutline,
} from 'ionicons/icons';
import { MobileTelehealthSession, TelehealthService } from '../../services/telehealth.service';
import { ClinicalDraftService } from '../../services/clinical-draft.service';
import { ProgressNoteService } from '../../services/progress-note.service';

@Component({
  standalone: true,
  selector: 'app-mobile-telehealth-session',
  imports: [
    CommonModule, FormsModule, IonBadge, IonButton, IonCheckbox, IonContent,
    IonHeader, IonIcon, IonInput, IonTextarea, IonTitle, IonToolbar,
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

        <section class="video-stage" *ngIf="s.state !== 'ended' && s.state !== 'cancelled' && s.state !== 'failed'" aria-label="Telehealth video consultation">
          <div #remote class="media remote-stage"></div>
          <span class="remote-label">NP / other participant</span>
          <div class="waiting-video" *ngIf="!connected">Join the secure video consultation</div>

          <aside class="self-preview" [class.front-facing]="cameraFacing === 'user'">
            <div #local class="media local-stage"></div>
            <span>{{ videoEnabled ? 'You' : 'Camera off' }}</span>
          </aside>

          <nav class="call-controls" aria-label="Video controls">
            <ion-button
              *ngIf="!connected && s.state !== 'ended'"
              class="join-call"
              [disabled]="busy || s.consentStatus !== 'accepted' || !isOpen"
              (click)="join()">
              Join video
            </ion-button>

            <ng-container *ngIf="connected">
              <button
                type="button"
                class="round-control"
                [class.control-off]="!audioEnabled"
                (click)="mute()"
                [attr.aria-label]="audioEnabled ? 'Mute microphone' : 'Unmute microphone'">
                <ion-icon [name]="audioEnabled ? 'mic-outline' : 'mic-off-outline'"></ion-icon>
              </button>

              <button
                type="button"
                class="round-control"
                [class.control-off]="!videoEnabled"
                [disabled]="switchingCamera"
                (click)="camera()"
                [attr.aria-label]="videoEnabled ? 'Turn camera off' : 'Turn camera on'">
                <ion-icon [name]="videoEnabled ? 'videocam-outline' : 'videocam-off-outline'"></ion-icon>
              </button>

              <button
                type="button"
                class="round-control"
                [disabled]="switchingCamera || cameraCount < 2"
                (click)="switchCamera()"
                [attr.aria-label]="cameraFacing === 'user' ? 'Use rear camera to show wound' : 'Use front camera'">
                <ion-icon name="camera-reverse-outline"></ion-icon>
              </button>

              <button
                type="button"
                class="round-control hangup"
                (click)="leave()"
                aria-label="Leave video call">
                <ion-icon name="call-outline"></ion-icon>
              </button>
            </ng-container>
          </nav>
        </section>

        <div class="video-actions">
          <ion-button *ngIf="s.participant === 'facilitator' && (s.state === 'scheduled' || s.state === 'waiting')" color="danger" fill="outline" [disabled]="busy" (click)="cancel()">Cancel consultation</ion-button>
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
    main{padding:18px;max-width:980px;margin:auto}.session-head,.note-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}
    p[role=alert]{color:var(--ion-color-danger)}ion-checkbox{margin:10px 0}.video-actions{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}
    .video-stage{position:relative;height:clamp(380px,68vh,760px);background:#0d1a16;border-radius:24px;overflow:hidden;isolation:isolate;box-shadow:0 18px 54px rgba(0,0,0,.22)}
    .media{width:100%;height:100%;overflow:hidden}.remote-stage{display:flex;align-items:center;justify-content:center}
    .remote-stage ::ng-deep video{width:100%;height:100%;object-fit:contain;display:block}.remote-stage ::ng-deep audio{display:none}
    .remote-label,.self-preview>span{position:absolute;background:rgba(11,32,24,.76);color:#fff;padding:6px 10px;border-radius:9px;font-size:.76rem;backdrop-filter:blur(8px)}
    .remote-label{left:14px;top:14px}.waiting-video{position:absolute;inset:0;display:grid;place-items:center;color:#dcebe5;font-weight:700;pointer-events:none}
    .self-preview{position:absolute;right:16px;top:16px;width:clamp(108px,24%,210px);height:clamp(140px,25vh,220px);background:#23352f;border:2px solid rgba(255,255,255,.74);border-radius:16px;overflow:hidden;box-shadow:0 8px 28px rgba(0,0,0,.38)}
    .local-stage ::ng-deep video{width:100%;height:100%;object-fit:cover;display:block}.self-preview.front-facing ::ng-deep video{transform:scaleX(-1)}
    .self-preview>span{left:7px;bottom:7px}
    .call-controls{position:absolute;z-index:4;bottom:max(18px,env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);display:flex;align-items:center;justify-content:center;gap:12px;padding:11px 14px;border-radius:30px;background:rgba(8,25,19,.86);box-shadow:0 8px 28px rgba(0,0,0,.38);backdrop-filter:blur(14px)}
    .round-control{width:50px;height:50px;border:0;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.15);color:#fff;font-size:24px;cursor:pointer}
    .round-control.control-off{background:#8a5a1d}.round-control.hangup{background:#d23f4f;transform:rotate(135deg)}.round-control:disabled{opacity:.45;cursor:not-allowed}
    .join-call{--border-radius:999px;--background:#0b7551;min-width:160px}.provider-note{margin-top:24px;padding:18px;border-radius:18px;background:var(--ion-color-light)}.provider-note ion-input,.provider-note ion-textarea{margin:10px 0}
    .eyebrow{font-size:10px;letter-spacing:.14em;font-weight:800;color:var(--ion-color-success);margin:0}.draft-state,.small{font-size:12px;color:var(--ion-color-medium)}
    @media(max-width:640px){main{padding:10px}.video-stage{height:72vh;border-radius:18px}.self-preview{right:10px;top:10px;width:31%;height:24%}.call-controls{gap:9px;padding:9px 11px}.round-control{width:46px;height:46px;font-size:22px}}
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
  cameraFacing: 'user' | 'environment' = 'user';
  switchingCamera = false;
  cameraCount = 0;

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
    addIcons({
      callOutline,
      cameraReverseOutline,
      micOffOutline,
      micOutline,
      videocamOffOutline,
      videocamOutline,
    });
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
      const video = await createLocalVideoTrack({width: 960, facingMode: 'user'});
      if (generation !== this.generation) { video.stop(); return; }
      this.video = video;
      this.cameraFacing = 'user';
      this.cameraCount = await navigator.mediaDevices?.enumerateDevices()
        .then((devices) => devices.filter((device) => device.kind === 'videoinput').length)
        .catch(() => 2) || 1;
      this.attachLocalVideo();
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
    if (!this.video || this.switchingCamera) return;
    this.videoEnabled ? this.video.disable() : this.video.enable();
    this.videoEnabled = !this.videoEnabled;
  }

  async switchCamera(): Promise<void> {
    const track = this.video;
    if (!this.room || !track || this.switchingCamera || this.cameraCount < 2) return;
    const next: 'user' | 'environment' = this.cameraFacing === 'user' ? 'environment' : 'user';
    this.switchingCamera = true;
    this.error = '';
    try {
      await track.restart({ facingMode: { exact: next }, width: { ideal: 1280 } });
      if (this.video !== track || !this.room) {
        track.stop();
        return;
      }
      this.cameraFacing = next;
      if (!this.videoEnabled) track.disable();
      this.attachLocalVideo();
    } catch {
      if (this.video !== track || !this.room) {
        track.stop();
        return;
      }
      try {
        await track.restart({ facingMode: { ideal: this.cameraFacing } });
        if (this.video !== track || !this.room) {
          track.stop();
          return;
        }
        if (!this.videoEnabled) track.disable();
        this.attachLocalVideo();
      } catch {
        // Keep audio and the Twilio room alive even if camera recovery fails.
      }
      this.error = 'Unable to switch cameras. The consultation remains connected.';
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
    this.cameraFacing = 'user';
    this.switchingCamera = false;
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

  private attachLocalVideo(): void {
    const host = this.local?.nativeElement;
    if (!host) return;
    host.replaceChildren();
    if (this.video) host.appendChild(this.video.attach());
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