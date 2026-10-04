import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonInput, IonTextarea, IonCheckbox } from '@ionic/angular/standalone';
import { connect, createLocalAudioTrack, createLocalVideoTrack, LocalAudioTrack, LocalVideoTrack, RemoteTrack, Room } from 'twilio-video';
import { MobileTelehealthSession, TelehealthService } from '../../services/telehealth.service';

@Component({standalone: true, selector: 'app-mobile-telehealth-session',
  imports: [CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonInput, IonTextarea, IonCheckbox],
  template: `
    <ion-header><ion-toolbar><ion-title>Telehealth · Field consultation</ion-title></ion-toolbar></ion-header>
    <ion-content><main><p role="status">{{ status }}</p><p role="alert" *ngIf="error">{{ error }}</p>
      <ng-container *ngIf="session as s">
        <h1>{{ s.clinicalContext?.patientName || 'Patient consultation' }}</h1>
        <p>{{ s.clinicalContext?.woundLabel }} · {{ s.state }} · Consent: {{ s.consentStatus }}</p>
        <section *ngIf="s.participant === 'facilitator' && (s.state === 'scheduled' || s.state === 'waiting') && s.consentStatus !== 'accepted'">
          <h2>Consent with the patient</h2>
          <ion-checkbox [(ngModel)]="present">The patient is physically present with me</ion-checkbox><br>
          <ion-checkbox [(ngModel)]="consented">Patient identity verified and verbal consent obtained</ion-checkbox>
          <ion-input label="Patient location now" labelPlacement="stacked" [(ngModel)]="location" maxlength="160"></ion-input>
          <ion-textarea label="Consent evidence" labelPlacement="stacked" [(ngModel)]="evidence" maxlength="1000"></ion-textarea>
          <ion-button [disabled]="busy || !present || !consented || location.trim().length < 3 || evidence.trim().length < 12" (click)="recordConsent()">Record facilitated consent</ion-button>
        </section>
        <div class="videos"><section><h2>Your camera</h2><div #local class="media"></div></section><section><h2>NP / other participant</h2><div #remote class="media"></div></section></div>
        <ion-button *ngIf="!connected" [disabled]="busy || s.consentStatus !== 'accepted' || !isOpen" (click)="join()">Join video consultation</ion-button>
        <ion-button *ngIf="connected" (click)="mute()">{{ audioEnabled ? 'Mute' : 'Unmute' }}</ion-button>
        <ion-button *ngIf="connected" (click)="camera()">{{ videoEnabled ? 'Camera off' : 'Camera on' }}</ion-button>
        <ion-button *ngIf="connected" fill="outline" (click)="leave()">Leave video</ion-button>
        <ion-button *ngIf="s.participant === 'facilitator' && (s.state === 'scheduled' || s.state === 'waiting')" color="danger" [disabled]="busy" (click)="cancel()">Cancel consultation</ion-button>
        <ion-button fill="outline" [disabled]="busy" (click)="refresh()">Refresh session</ion-button>
      </ng-container>
      <p>The NP starts/ends the encounter and signs the provider note in JADE. Leaving video does not complete the physical visit or create a claim.</p>
      <p>If camera/microphone access is unavailable, use a supported browser/device. No insecure bypass is provided.</p>
    </main></ion-content>`,
  styles: [`main{padding:18px;max-width:950px;margin:auto}.videos{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}.media{background:#10251d;min-height:180px;overflow:hidden}p[role=alert]{color:var(--ion-color-danger)}ion-checkbox{margin:10px 0}`],
})
export class TelehealthSessionPage implements OnDestroy {
  @ViewChild('local') local?: ElementRef<HTMLElement>; @ViewChild('remote') remote?: ElementRef<HTMLElement>;
  session: MobileTelehealthSession | null = null;
  busy = false; status = ''; error = ''; present = false; consented = false; location = ''; evidence = '';
  connected = false; audioEnabled = true; videoEnabled = true;
  private room: Room | null = null; private audio: LocalAudioTrack | null = null; private video: LocalVideoTrack | null = null;
  private timer?: ReturnType<typeof setInterval>; private generation = 0; private appointmentId: string;
  constructor(private service: TelehealthService, route: ActivatedRoute) { this.appointmentId = route.snapshot.paramMap.get('appointmentId') || ''; }
  get isOpen(): boolean { return !!this.session && ['waiting', 'in_progress'].includes(this.session.state); }
  ionViewWillEnter(): void { this.stopPolling(); void this.refresh(); this.timer = setInterval(() => { if (document.visibilityState !== 'hidden') void this.refresh(); }, 12000); }
  ionViewWillLeave(): void { this.stopPolling(); this.leave(); }
  ngOnDestroy(): void { this.stopPolling(); this.leave(); }
  @HostListener('document:visibilitychange') visibility(): void { if (document.visibilityState === 'hidden') this.leave(); }
  async refresh(): Promise<void> {
    if (this.busy || !this.appointmentId) return; this.busy = true;
    try { this.session = await this.service.session(this.appointmentId);
      if (['ended', 'cancelled', 'failed'].includes(this.session.state)) { this.leave(); this.status = 'Consultation closed. Provider documentation remains in JADE.'; }
    } catch (e: any) { this.leave(); this.error = e?.message || 'Unable to verify session access.'; } finally { this.busy = false; }
  }
  async recordConsent(): Promise<void> {
    if (!this.session || this.busy || !this.present || !this.consented || this.location.trim().length < 3 || this.evidence.trim().length < 12) return;
    this.busy = true; this.error = '';
    try { this.session = await this.service.consent({sessionId: this.session.id, consentVersion: this.session.consentVersion, patientLocation: this.location.trim(), evidenceNote: this.evidence.trim(), patientPresent: true, consentConfirmed: true}); this.status = 'Consent recorded. Join and notify the assigned NP.'; }
    catch (e: any) { this.error = e?.message || 'Consent failed.'; } finally { this.busy = false; }
  }
  async join(): Promise<void> {
    if (!this.session || this.busy || this.connected || !this.isOpen || this.session.consentStatus !== 'accepted') return;
    this.busy = true; this.error = ''; const generation = ++this.generation;
    try {
      this.status = 'Requesting secure video access…'; const grant = await this.service.videoToken(this.session.id);
      if (generation !== this.generation) return;
      this.status = 'Allow camera and microphone access…'; const audio = await createLocalAudioTrack();
      if (generation !== this.generation) { audio.stop(); return; } this.audio = audio;
      const video = await createLocalVideoTrack({width: 640});
      if (generation !== this.generation) { video.stop(); return; } this.video = video;
      this.local?.nativeElement.replaceChildren(video.attach());
      this.status = 'Connecting…'; const room = await connect(grant.token, {name: grant.room, tracks: [audio, video]});
      if (generation !== this.generation) { room.disconnect(); return; }
      this.room = room; this.connected = true; this.audioEnabled = true; this.videoEnabled = true;
      room.participants.forEach(p => p.tracks.forEach(pub => { if (pub.track) this.attach(pub.track); }));
      room.on('trackSubscribed', track => this.attach(track));
      room.on('trackUnsubscribed', track => { if (track.kind !== 'data') track.detach().forEach(el => el.remove()); });
      room.on('disconnected', () => { this.room = null; this.leave(); this.status = 'Video disconnected.'; });
      this.status = 'Connected. The assigned NP controls the clinical encounter.';
    } catch (e: any) { this.leave(); this.error = e?.message || 'Video failed. Verify device permissions and retry.'; } finally { this.busy = false; }
  }
  mute(): void { this.audioEnabled ? this.audio?.disable() : this.audio?.enable(); this.audioEnabled = !this.audioEnabled; }
  camera(): void { this.videoEnabled ? this.video?.disable() : this.video?.enable(); this.videoEnabled = !this.videoEnabled; }
  leave(): void { this.generation++; const room = this.room; this.room = null; room?.disconnect(); this.audio?.stop(); this.video?.stop(); this.audio = null; this.video = null; this.connected = false; this.local?.nativeElement.replaceChildren(); this.remote?.nativeElement.replaceChildren(); }
  async cancel(): Promise<void> {
    if (!this.session || this.busy) return; this.busy = true; this.error = '';
    try { this.session = await this.service.cancel(this.session); this.leave(); }
    catch (e: any) { this.leave(); this.error = e?.message || 'Cancellation failed; refresh and retry.'; } finally { this.busy = false; }
  }
  private attach(track: RemoteTrack): void { if (track.kind === 'data') return; const el = track.attach(); el.style.width = '100%'; this.remote?.nativeElement.appendChild(el); }
  private stopPolling(): void { if (this.timer) clearInterval(this.timer); this.timer = undefined; }
}
