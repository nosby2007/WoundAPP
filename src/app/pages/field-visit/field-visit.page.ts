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
  calendarOutline,
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
            <ion-badge [color]="visit.status === 'not_done' ? 'danger' : visit.status === 'completed' ? 'success' : activeEvv ? 'warning' : 'primary'">
              {{ visit.status === 'not_done' ? 'Not done' : visit.status === 'completed' ? 'Completed' : activeEvv ? 'On site' : 'Scheduled' }}
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

            <ion-button expand="block" class="primary-action" *ngIf="visit.status !== 'completed' && visit.status !== 'not_done' && !activeEvv" [disabled]="busy" (click)="checkIn()">
              <ion-spinner *ngIf="busy" name="crescent"></ion-spinner>
              <span *ngIf="!busy">Check in now</span>
            </ion-button>

            <div class="attestation" *ngIf="visit.status !== 'completed' && visit.status !== 'not_done' && !activeEvv">
              <p class="eyebrow dark">VISIT CANNOT BE COMPLETED</p>
              <ion-item lines="none">
                <ion-select label="Reason" labelPlacement="stacked" [(ngModel)]="notDoneReasonCode" placeholder="Choose reason">
                  <ion-select-option *ngFor="let option of notDoneReasons" [value]="option.value">{{ option.label }}</ion-select-option>
                </ion-select>
              </ion-item>
              <ion-item lines="none">
                <ion-textarea label="Brief note" labelPlacement="stacked" autoGrow="true" [(ngModel)]="notDoneReason" placeholder="What prevented the visit?"></ion-textarea>
              </ion-item>
              <ion-button expand="block" color="danger" fill="outline" [disabled]="markingNotDone || !notDoneReasonCode || !notDoneReason.trim()" (click)="markNotDone()">
                <ion-spinner *ngIf="markingNotDone" name="crescent"></ion-spinner>
                <span *ngIf="!markingNotDone">Mark visit not done</span>
              </ion-button>
            </div>

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
            <div class="complete-state not-done-state" *ngIf="visit.status === 'not_done'">
              <div>
                <strong>Visit not done</strong>
                <p>{{ visit.statusReason || 'The clinician documented that the visit could not be completed.' }}</p>
                <ion-button size="small" color="danger" fill="outline" (click)="documentMissedVisit()">Document missed visit</ion-button>
              </div>
            </div>
          </ion-card-content>
        </ion-card>

        <ion-card class="followup-card" *ngIf="visit.status === 'completed' || visit.status === 'not_done'">
          <ion-card-content>
            <div class="section-head">
              <div><p class="eyebrow dark">CONTINUITY</p><h2>Schedule next visit</h2></div>
              <ion-icon [icon]="calendarOutline"></ion-icon>
            </div>

            <ng-container *ngIf="!nextAppointmentId; else nextScheduledTpl">
              <p class="followup-copy">{{ visit.status === 'not_done' ? 'Replan the missed visit when another attempt is appropriate.' : 'Create your own next visit before leaving the patient. Use the ordered visit frequency; this does not assign another clinician.' }}</p>
              <div class="preset-row">
                <ion-button size="small" fill="outline" (click)="setNextVisitDays(1)">Tomorrow</ion-button>
                <ion-button size="small" fill="outline" (click)="setNextVisitDays(2)">+2 days</ion-button>
                <ion-button size="small" fill="outline" (click)="setNextVisitDays(3)">+3 days</ion-button>
                <ion-button size="small" fill="outline" (click)="setNextVisitDays(7)">+7 days</ion-button>
              </div>
              <ion-item lines="none" class="next-date">
                <ion-input type="datetime-local" label="Next visit date & time" labelPlacement="stacked" [(ngModel)]="nextVisitLocal"></ion-input>
              </ion-item>
              <ion-item lines="none" class="next-date">
                <ion-select label="Planned duration" labelPlacement="stacked" [(ngModel)]="nextVisitDurationMinutes">
                  <ion-select-option [value]="30">30 minutes</ion-select-option>
                  <ion-select-option [value]="45">45 minutes</ion-select-option>
                  <ion-select-option [value]="60">60 minutes</ion-select-option>
                  <ion-select-option [value]="90">90 minutes</ion-select-option>
                  <ion-select-option [value]="120">120 minutes</ion-select-option>
                </ion-select>
              </ion-item>
              <div class="status-banner" *ngIf="scheduleMessage" [class.error]="scheduleError">{{ scheduleMessage }}</div>
              <ion-button expand="block" [disabled]="schedulingNext || !nextVisitLocal" (click)="scheduleNextVisit()">
                <ion-spinner *ngIf="schedulingNext" name="crescent"></ion-spinner>
                <span *ngIf="!schedulingNext">Create my next visit</span>
              </ion-button>
              <ion-note>The appointment is assigned only to you. Frontdesk/Scheduler can later reassign it if operationally necessary.</ion-note>
            </ng-container>

            <ng-template #nextScheduledTpl>
              <div class="next-created">
                <ion-icon [icon]="checkmarkCircleOutline"></ion-icon>
                <div><strong>Next visit scheduled</strong><p>The follow-up is now in your schedule and will appear in Today on that date.</p></div>
              </div>
            </ng-template>
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
    :host{--ink:#10233f;--muted:#64748b;--line:#e6edf3;--green:#0b7551;--navy:#163959}ion-toolbar{--background:#fff;--color:var(--ink)}.page{padding:16px 16px 34px;background:#f5f8fb;min-height:100%}.hero{background:linear-gradient(145deg,#0a7250 0%,#113c56 78%);color:#fff;border-radius:28px;padding:22px;box-shadow:0 20px 45px rgba(15,50,70,.18)}.hero-top{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.hero h1{font-size:28px;line-height:1.1;margin:3px 0 7px}.hero p{margin:0;opacity:.83}.eyebrow{font-size:10px;letter-spacing:.16em;font-weight:800;margin:0 0 6px}.eyebrow.dark{color:#547086}.hero-grid{display:grid;grid-template-columns:1fr 1.4fr;gap:10px;margin-top:20px}.hero-grid div{background:rgba(255,255,255,.09);padding:12px;border-radius:16px}.hero-grid span,.info-row span,.evv-proof span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.08em;opacity:.72;margin-bottom:4px}.hero-grid strong{font-size:13px}.quick-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin:12px 0}.quick{border:0;background:#fff;color:var(--ink);border-radius:16px;min-height:68px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;text-decoration:none;box-shadow:0 5px 18px rgba(30,55,75,.06)}.quick ion-icon{font-size:22px;color:var(--green)}ion-card{margin:12px 0;border-radius:24px;box-shadow:0 8px 28px rgba(30,55,75,.07)}ion-card-content{padding:20px}.section-head{display:flex;justify-content:space-between;gap:12px}.section-head h2,.info-card h2{margin:0;color:var(--ink);font-size:20px}.section-head>ion-icon{font-size:30px;color:var(--green)}.timeline{margin:20px 0}.step{display:grid;grid-template-columns:36px 1fr;gap:10px;position:relative;padding-bottom:18px}.step:not(:last-child):before{content:'';position:absolute;left:17px;top:34px;bottom:1px;width:2px;background:#dfe8ee}.step>span{height:34px;width:34px;border-radius:50%;display:grid;place-items:center;background:#edf2f6;color:#718096;font-weight:800}.step.done>span{background:#d9f3e8;color:#08724d}.step strong{color:var(--ink)}.step p{margin:3px 0 0;color:var(--muted);font-size:12px}.status-banner{background:#e9f6ef;color:#0b6849;border-radius:14px;padding:11px 13px;margin:12px 0;font-size:13px}.status-banner.error{background:#fff0f0;color:#a33333}.primary-action{margin-top:16px;height:48px}.evv-proof{display:flex;gap:12px;align-items:center;background:#f1f7f5;border-radius:18px;padding:13px;margin:8px 0 16px}.proof-icon{width:40px;height:40px;border-radius:14px;background:#dbefe7;display:grid;place-items:center;color:var(--green);font-size:22px}.evv-proof strong{display:block;color:var(--ink);font-size:12px}.attestation{background:#f8fafc;border:1px solid var(--line);border-radius:18px;padding:14px;margin-top:14px}.attestation ion-item{--background:transparent;--padding-start:0;--inner-padding-end:0}.attestation ion-note{font-size:11px}.complete-state{display:flex;gap:12px;align-items:flex-start;background:#ebf8f1;border-radius:18px;padding:14px}.complete-state ion-icon{font-size:30px;color:var(--green)}.not-done-state{background:#fff0f0;border:1px solid #f2caca}.not-done-state strong{color:#a52222}.complete-state strong{color:var(--ink)}.complete-state p{margin:3px 0;color:var(--muted);font-size:12px}.instructions{color:#42566b;line-height:1.55}.info-row{display:flex;gap:12px;border-top:1px solid var(--line);padding-top:14px;margin-top:14px}.info-row ion-icon{font-size:22px;color:var(--green)}.info-row strong{color:var(--ink)}.followup-card{border:1px solid #dcebe5}.followup-copy{color:var(--muted);line-height:1.5}.preset-row{display:flex;gap:7px;flex-wrap:wrap;margin:12px 0}.next-date{--background:#f8fafc;border:1px solid var(--line);border-radius:14px;margin:10px 0}.next-created{display:flex;gap:12px;align-items:flex-start;background:#ebf8f1;border-radius:18px;padding:14px;margin-top:14px}.next-created ion-icon{font-size:30px;color:var(--green)}.next-created p{margin:3px 0;color:var(--muted);font-size:12px}.state{min-height:70vh;display:grid;place-items:center;align-content:center;text-align:center;padding:28px;color:var(--muted)}.state h2{color:var(--ink)}@media(max-width:430px){.hero-grid{grid-template-columns:1fr}.hero h1{font-size:25px}}
  `],
})
export class FieldVisitPage implements OnInit {
  readonly arrowBackOutline = arrowBackOutline;
  readonly callOutline = callOutline;
  readonly calendarOutline = calendarOutline;
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
  nextVisitLocal = '';
  nextVisitDurationMinutes = 60;
  schedulingNext = false;
  scheduleMessage = '';
  scheduleError = false;
  nextAppointmentId: string | null = null;
  notDoneReasonCode = '';
  notDoneReason = '';
  markingNotDone = false;
  readonly notDoneReasons = [
    { value: 'patient_unavailable', label: 'Patient unavailable / not home' },
    { value: 'patient_refused', label: 'Patient refused visit' },
    { value: 'hospitalized', label: 'Patient hospitalized / transferred' },
    { value: 'appointment_conflict', label: 'Patient had another appointment' },
    { value: 'unsafe_environment', label: 'Unsafe environment / unable to enter' },
    { value: 'clinician_unavailable', label: 'Clinician unavailable' },
    { value: 'other', label: 'Other' },
  ];

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
      this.nextAppointmentId = this.visit?.nextAppointmentId ?? null;
      if (this.visit?.patientId && this.visit.status !== 'completed') {
        this.activeEvv = await this.visits.openVisit(this.visit.patientId);
        await this.visits.recordJourneyStep(
          this.visit.patientId,
          this.visit.woundVisitId,
          this.visit.id,
          this.activeEvv ? 'on_site' : 'visit_workspace',
          '/tabs/today/visit/' + this.visit.id
        );
      }
    } finally {
      this.loading = false;
    }
  }

  back(): void { void this.router.navigate(['/tabs/today']); }
  chart(): void {
    if (!this.visit?.patientId) return;
    void this.visits.recordJourneyStep(
      this.visit.patientId,
      this.visit.woundVisitId,
      this.visit.id,
      'clinical_command',
      `/tabs/skin-wound/${this.visit.patientId}/assessments`
    );
    void this.router.navigate(
      ['/tabs/skin-wound', this.visit.patientId, 'assessments'],
      { queryParams: { appointmentId: this.visit.id, woundVisitId: this.visit.woundVisitId ?? '' } }
    );
  }
  directions(): void { if (this.address) window.open('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(this.address), '_blank', 'noopener'); }
  locationText(location: any): string { return describeEvvLocation(location); }
  checkpointText(checkpoint: any): string { return checkpoint?.location ? describeEvvLocation(checkpoint.location) : 'Arrival captured'; }

  async checkIn(): Promise<void> {
    if (!this.visit?.patientId || this.busy) return;
    this.busy = true; this.message = ''; this.isError = false;
    try {
      const result = await this.visits.checkIn(
        this.visit.patientId,
        this.visit.visitType || 'routine',
        {
          appointmentId: this.visit.id,
          woundVisitId: this.visit.woundVisitId ?? null,
          woundId: this.visit.woundId ?? null,
          episodeId: this.visit.episodeId ?? null,
          clinicianRole: this.visit.assignedToRole ?? null,
        }
      );
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

  async markNotDone(): Promise<void> {
    if (!this.visit || this.markingNotDone) return;
    this.markingNotDone = true;
    this.message = '';
    this.isError = false;
    try {
      const result = await this.work.markVisitNotDone(this.visit.id, this.notDoneReasonCode, this.notDoneReason);
      this.visit = {
        ...this.visit,
        woundVisitId: result.woundVisitId,
        status: 'not_done',
        statusReasonCode: this.notDoneReasonCode,
        statusReason: this.notDoneReason.trim(),
      };
      this.message = 'Visit marked not done. Add a missed-visit progress note and reschedule if another attempt is appropriate.';
    } catch (error: any) {
      this.isError = true;
      this.message = error?.message || 'Unable to mark this visit not done.';
    } finally {
      this.markingNotDone = false;
    }
  }

  documentMissedVisit(): void {
    if (!this.visit?.patientId) return;
    void this.router.navigate(
      ['/tabs', 'skin-wound', this.visit.patientId, 'wound-note'],
      {
        queryParams: {
          appointmentId: this.visit.id,
          woundVisitId: this.visit.woundVisitId ?? '',
          visitOutcome: 'not_done',
          reasonCode: this.visit.statusReasonCode ?? this.notDoneReasonCode,
          reason: this.visit.statusReason ?? this.notDoneReason,
        },
      }
    );
  }

  setNextVisitDays(days: number): void {
    const base = new Date();
    const currentStart = this.work.toDate(this.visit?.start);
    if (currentStart) {
      base.setHours(currentStart.getHours(), currentStart.getMinutes(), 0, 0);
    } else {
      base.setHours(9, 0, 0, 0);
    }
    base.setDate(base.getDate() + days);
    this.nextVisitLocal = this.toLocalInput(base);
    this.scheduleMessage = '';
    this.scheduleError = false;
  }

  async scheduleNextVisit(): Promise<void> {
    if (!this.visit || this.schedulingNext || !this.nextVisitLocal) return;
    const start = new Date(this.nextVisitLocal);
    if (Number.isNaN(start.getTime())) {
      this.scheduleError = true;
      this.scheduleMessage = 'Choose a valid next visit date and time.';
      return;
    }

    this.schedulingNext = true;
    this.scheduleError = false;
    this.scheduleMessage = '';
    try {
      this.nextAppointmentId = await this.work.scheduleNextVisit(this.visit.id, start, this.nextVisitDurationMinutes);
      this.visit = { ...this.visit, nextAppointmentId: this.nextAppointmentId };
      this.scheduleMessage = 'Next visit created and assigned to you.';
    } catch (error: any) {
      this.scheduleError = true;
      this.scheduleMessage = error?.message || 'Unable to schedule the next visit.';
    } finally {
      this.schedulingNext = false;
    }
  }

  private toLocalInput(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
}
