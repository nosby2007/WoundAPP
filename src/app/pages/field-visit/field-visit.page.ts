import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import {
  arrowBackOutline,
  callOutline,
  checkmarkCircleOutline,
  folderOpenOutline,
  locationOutline,
  navigateOutline,
  shieldCheckmarkOutline,
  timeOutline,
} from 'ionicons/icons';
import { FieldVisit, FieldWorkService } from '../../services/field-work.service';
import { FieldVisit as EvvVisit, VisitService } from '../../services/visit.service';
import { EVV_ATTESTATION_METHODS, EvvPatientAttestation, describeEvvLocation } from '../../shared/evv';

@Component({
  selector: 'app-field-visit',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    IonIcon,
    IonCard,
    IonCardContent,
    IonBadge,
    IonItem,
    IonLabel,
    IonNote,
    IonSpinner,
    IonSelect,
    IonSelectOption,
    IonInput,
    IonTextarea,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-button slot="start" fill="clear" (click)="back()"><ion-icon [icon]="arrowBackOutline"></ion-icon></ion-button>
        <ion-title>Visit workspace</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="page" *ngIf="visit; else stateTpl">
        <section class="hero">
          <div class="hero-top">
            <div>
              <p class="eyebrow">FIELD VISIT</p>
              <h1>{{ visit.patient?.name || visit.patientName }}</h1>
              <p>{{ visit.visitType || 'Scheduled visit' }} · {{ work.toDate(visit.start) | date:'shortTime' }}</p>
            </div>
            <ion-badge [color]="visit.status === 'completed' ? 'success' : activeEvv ? 'warning' : 'primary'">
              {{ visit.status === 'completed' ? 'Completed' : activeEvv ? 'On site' : 'Scheduled' }}
            </ion-badge>
          </div>
          <div class="hero-grid">
            <div><span>Assigned to</span><strong>{{ visit.assignedToName || 'You' }}</strong></div>
            <div><span>Patient location</span><strong>{{ address || 'Not recorded' }}</strong></div>
          </div>
        </section>

        <section class="quick-actions">
          <button class="quick" *ngIf="address" (click)="directions()"><ion-icon [icon]="navigateOutline"></ion-icon><span>Directions</span></button>
          <a class="quick" *ngIf="phone" [href]="'tel:' + phone"><ion-icon [icon]="callOutline"></ion-icon><span>Call</span></a>
          <button class="quick" *ngIf="visit.patientId" (click)="chart()"><ion-icon [icon]="folderOpenOutline"></ion-icon><span>Chart</span></button>
        </section>

        <ion-card class="command-card">
          <ion-card-content>
            <div class="section-head"><div><p class="eyebrow dark">VISIT COMMAND</p><h2>Point-of-care workflow</h2></div><ion-icon [icon]="shieldCheckmarkOutline"></ion-icon></div>
            <div class="timeline">
              <div class="step done"><span>1</span><div><strong>Assigned</strong><p>{{ work.toDate(visit.start) | date:'medium' }}</p></div></div>
              <div class="step" [class.done]="!!activeEvv || visit.status === 'completed'"><span>2</span><div><strong>Check in</strong><p>{{ activeEvv ? checkpointText(activeEvv.checkIn) : 'Capture arrival and location at point of care.' }}</p></div></div>
              <div class="step" [class.done]="visit.status === 'completed'"><span>3</span><div><strong>Check out</strong><p>{{ visit.status === 'completed' ? 'Visit closed.' : 'Capture departure and attestation when leaving.' }}</p></div></div>
            </div>

            <div class="status-banner" *ngIf="message" [class.error]="isError">{{ message }}</div>

            <ion-button expand="block" class="primary-action" *ngIf="visit.status !== 'completed' && !activeEvv" [disabled]="busy" (click)="checkIn()">
              <ion-spinner *ngIf="busy" name="crescent"></ion-spinner>
              <span *ngIf="!busy">Check in now</span>
            </ion-button>

            <ng-container *ngIf="visit.status !== 'completed' && activeEvv">
              <div class="evv-proof">
                <div class="proof-icon"><ion-icon [icon]="locationOutline"></ion-icon></div>
                <div><span>Arrival evidence</span><strong>{{ locationText(activeEvv.checkIn?.location) }}</strong></div>
              </div>

              <div class="attestation">
                <p class="eyebrow dark">CHECK-OUT ATTESTATION</p>
                <ion-item lines="none">
                  <ion-select label="Patient / responsible party" labelPlacement="stacked" [(ngModel)]="attestationMethod" placeholder="Choose outcome">
                    <ion-select-option *ngFor="let option of attestationOptions" [value]="option.value">{{ option.label }}</ion-select-option>
                  </ion-select>
                </ion-item>
                <ion-item lines="none" *ngIf="attestationMethod === 'verbal'">
                  <ion-input label="Person confirming" labelPlacement="stacked" [(ngModel)]="attestedByName" placeholder="Name"></ion-input>
                </ion-item>
                <ion-item lines="none" *ngIf="attestationMethod === 'verbal'">
                  <ion-input label="Relationship (optional)" labelPlacement="stacked" [(ngModel)]="relationship" placeholder="Patient, spouse, caregiver…"></ion-input>
                </ion-item>
                <ion-item lines="none" *ngIf="attestationMethod === 'unable_to_attest'">
                  <ion-textarea label="Why unable to attest" labelPlacement="stacked" autoGrow="true" [(ngModel)]="attestationReason"></ion-textarea>
                </ion-item>
                <ion-note>You can leave the selection blank when nobody was asked. The app will not invent a “not required” attestation.</ion-note>
              </div>

              <ion-button expand="block" color="success" class="primary-action" [disabled]="busy" (click)="checkOut()">
                <ion-spinner *ngIf="busy" name="crescent"></ion-spinner>
                <span *ngIf="!busy">Check out & complete visit</span>
              </ion-button>
            </ng-container>

            <div class="complete-state" *ngIf="visit.status === 'completed'">
              <ion-icon [icon]="checkmarkCircleOutline"></ion-icon>
              <div><strong>Visit completed</strong><p>The scheduling record is closed. EVV evidence remains in the patient visit record.</p></div>
            </div>
          </ion-card-content>
        </ion-card>

        <ion-card class="info-card">
          <ion-card-content>
            <p class="eyebrow dark">ASSIGNMENT</p>
            <h2>Visit instructions</h2>
            <p class="instructions">{{ visit.appointmentDetails || 'No additional visit instructions were entered.' }}</p>
            <div class="info-row"><ion-icon [icon]="timeOutline"></ion-icon><div><span>Scheduled window</span><strong>{{ work.toDate(visit.start) | date:'shortTime' }}<ng-container *ngIf="visit.end"> – {{ work.toDate(visit.end) | date:'shortTime' }}</ng-container></strong></div></div>
          </ion-card-content>
        </ion-card>
      </div>

      <ng-template #stateTpl>
        <div class="state" *ngIf="loading"><ion-spinner></ion-spinner><p>Preparing secure visit workspace…</p></div>
        <div class="state" *ngIf="!loading"><h2>Visit unavailable</h2><p>This appointment is not assigned to this account, no longer exists, or could not be loaded.</p><ion-button (click)="back()">Back to Today</ion-button></div>
      </ng-template>
    </ion-content>
  `,
  styles: [`
    :host{--ink:#10233f;--muted:#64748b;--line:#e6edf3;--green:#0b7551;--navy:#163959}ion-toolbar{--background:#fff;--color:var(--ink)}.page{padding:16px 16px 34px;background:#f5f8fb;min-height:100%}.hero{background:linear-gradient(145deg,#0a7250 0%,#113c56 78%);color:#fff;border-radius:28px;padding:22px;box-shadow:0 20px 45px rgba(15,50,70,.18)}.hero-top{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.hero h1{font-size:28px;line-height:1.1;margin:3px 0 7px}.hero p{margin:0;opacity:.83}.eyebrow{font-size:10px;letter-spacing:.16em;font-weight:800;margin:0 0 6px}.eyebrow.dark{color:#547086}.hero-grid{display:grid;grid-template-columns:1fr 1.4fr;gap:10px;margin-top:20px}.hero-grid div{background:rgba(255,255,255,.09);padding:12px;border-radius:16px}.hero-grid span,.info-row span,.evv-proof span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.08em;opacity:.72;margin-bottom:4px}.hero-grid strong{font-size:13px}.quick-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin:12px 0}.quick{border:0;background:#fff;color:var(--ink);border-radius:16px;min-height:68px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;text-decoration:none;box-shadow:0 5px 18px rgba(30,55,75,.06)}.quick ion-icon{font-size:22px;color:var(--green)}ion-card{margin:12px 0;border-radius:24px;box-shadow:0 8px 28px rgba(30,55,75,.07)}ion-card-content{padding:20px}.section-head{display:flex;justify-content:space-between;gap:12px}.section-head h2,.info-card h2{margin:0;color:var(--ink);font-size:20px}.section-head>ion-icon{font-size:30px;color:var(--green)}.timeline{margin:20px 0}.step{display:grid;grid-template-columns:36px 1fr;gap:10px;position:relative;padding-bottom:18px}.step:not(:last-child):before{content:'';position:absolute;left:17px;top:34px;bottom:1px;width:2px;background:#dfe8ee}.step>span{height:34px;width:34px;border-radius:50%;display:grid;place-items:center;background:#edf2f6;color:#718096;font-weight:800}.step.done>span{background:#d9f3e8;color:#08724d}.step strong{color:var(--ink)}.step p{margin:3px 0 0;color:var(--muted);font-size:12px}.status-banner{background:#e9f6ef;color:#0b6849;border-radius:14px;padding:11px 13px;margin:12px 0;font-size:13px}.status-banner.error{background:#fff0f0;color:#a33333}.primary-action{margin-top:16px;height:48px}.evv-proof{display:flex;gap:12px;align-items:center;background:#f1f7f5;border-radius:18px;padding:13px;margin:8px 0 16px}.proof-icon{width:40px;height:40px;border-radius:14px;background:#dbefe7;display:grid;place-items:center;color:var(--green);font-size:22px}.evv-proof strong{display:block;color:var(--ink);font-size:12px}.attestation{background:#f8fafc;border:1px solid var(--line);border-radius:18px;padding:14px;margin-top:14px}.attestation ion-item{--background:transparent;--padding-start:0;--inner-padding-end:0}.attestation ion-note{font-size:11px}.complete-state{display:flex;gap:12px;align-items:flex-start;background:#ebf8f1;border-radius:18px;padding:14px}.complete-state ion-icon{font-size:30px;color:var(--green)}.complete-state strong{color:var(--ink)}.complete-state p{margin:3px 0;color:var(--muted);font-size:12px}.instructions{color:#42566b;line-height:1.55}.info-row{display:flex;gap:12px;border-top:1px solid var(--line);padding-top:14px;margin-top:14px}.info-row ion-icon{font-size:22px;color:var(--green)}.info-row strong{color:var(--ink)}.state{min-height:70vh;display:grid;place-items:center;align-content:center;text-align:center;padding:28px;color:var(--muted)}.state h2{color:var(--ink)}@media(max-width:430px){.hero-grid{grid-template-columns:1fr}.hero h1{font-size:25px}}
  `],
})
export class FieldVisitPage implements OnInit {
  readonly arrowBackOutline = arrowBackOutline;
  readonly callOutline = callOutline;
  readonly checkmarkCircleOutline = checkmarkCircleOutline;
  readonly folderOpenOutline = folderOpenOutline;
  readonly locationOutline = locationOutline;
  readonly navigateOutline = navigateOutline;
  readonly shieldCheckmarkOutline = shieldCheckmarkOutline;
  readonly timeOutline = timeOutline;
  readonly attestationOptions = EVV_ATTESTATION_METHODS;

  visit: FieldVisit | null = null;
  activeEvv: EvvVisit | null = null;
  loading = true;
  busy = false;
  message = '';
  isError = false;
  attestationMethod: EvvPatientAttestation['method'] | null = null;
  attestedByName = '';
  relationship = '';
  attestationReason = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public work: FieldWorkService,
    private visits: VisitService,
  ) {}

  get address(): string { return this.visit?.patient?.address || this.visit?.homeAddress || ''; }
  get phone(): string { return this.visit?.patient?.phone || this.visit?.patientTelephone || ''; }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('appointmentId') || '';
    try {
      this.visit = await this.work.getVisit(id);
      if (this.visit?.patientId && this.visit.status !== 'completed') {
        this.activeEvv = await this.visits.openVisit(this.visit.patientId);
      }
    } finally {
      this.loading = false;
    }
  }

  back(): void { void this.router.navigate(['/tabs/today']); }
  chart(): void { if (this.visit?.patientId) void this.router.navigate(['/tabs/skin-wound', this.visit.patientId, 'assessments']); }
  directions(): void { if (this.address) window.open('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(this.address), '_blank', 'noopener'); }
  locationText(location: any): string { return describeEvvLocation(location); }
  checkpointText(checkpoint: any): string { return checkpoint?.location ? describeEvvLocation(checkpoint.location) : 'Arrival captured'; }

  async checkIn(): Promise<void> {
    if (!this.visit?.patientId || this.busy) return;
    this.busy = true; this.message = ''; this.isError = false;
    try {
      const result = await this.visits.checkIn(this.visit.patientId, this.visit.visitType || 'routine');
      this.activeEvv = await this.visits.openVisit(this.visit.patientId);
      this.message = result.location.status === 'captured'
        ? 'Checked in. Arrival time and device location were captured.'
        : `Checked in, but location was not captured: ${describeEvvLocation(result.location)}.`;
    } catch (error: any) {
      this.isError = true;
      this.message = error?.message || 'Unable to check in.';
    } finally { this.busy = false; }
  }

  async checkOut(): Promise<void> {
    if (!this.visit?.patientId || !this.activeEvv || this.busy) return;
    this.busy = true; this.message = ''; this.isError = false;
    try {
      const attestation = this.attestationMethod ? {
        method: this.attestationMethod,
        attestedByName: this.attestedByName,
        relationship: this.relationship,
        reason: this.attestationReason,
      } : null;
      const result = await this.visits.checkOut(this.visit.patientId, this.activeEvv.id, attestation);
      await this.work.completeVisit(this.visit.id);
      this.visit = { ...this.visit, status: 'completed' };
      this.activeEvv = null;
      this.message = result.location.status === 'captured'
        ? 'Visit completed. Departure time and location were captured.'
        : `Visit completed. Departure location was not captured: ${describeEvvLocation(result.location)}.`;
    } catch (error: any) {
      this.isError = true;
      this.message = error?.message || 'Unable to check out.';
    } finally { this.busy = false; }
  }
}
