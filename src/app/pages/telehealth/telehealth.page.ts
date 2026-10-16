import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBadge, IonButton, IonContent, IonHeader, IonItem, IonLabel, IonList,
  IonSelect, IonSelectOption, IonSpinner, IonTextarea, IonTitle, IonToolbar,
} from '@ionic/angular/standalone';
import { Patient, PatientService } from '../../services/patient.service';
import {
  MobileTelehealthAppointment,
  TelehealthService,
} from '../../services/telehealth.service';
import { ClinicalDraftService } from '../../services/clinical-draft.service';

@Component({
  standalone: true,
  selector: 'app-field-telehealth',
  imports: [
    CommonModule, FormsModule, IonBadge, IonButton, IonContent, IonHeader, IonItem,
    IonLabel, IonList, IonSelect, IonSelectOption, IonSpinner, IonTextarea,
    IonTitle, IonToolbar,
  ],
  template: `
    <ion-header><ion-toolbar><ion-title>Telehealth</ion-title></ion-toolbar></ion-header>
    <ion-content><main>
      <section class="hero">
        <div><p class="eyebrow">FIELD TELEHEALTH</p><h1>Consultations</h1>
          <p>Create a consultation, resume one in progress, or reopen a completed encounter for provider documentation.</p>
        </div>
        <ion-button fill="outline" [disabled]="busy" (click)="refreshConsultations()">Refresh</ion-button>
      </section>

      <p role="alert" *ngIf="error">{{ error }}</p>
      <ion-spinner *ngIf="busy && !consultations.length"></ion-spinner>

      <section *ngIf="consultations.length">
        <h2>Open / recent consultations</h2>
        <ion-list>
          <ion-item button detail="true" *ngFor="let item of consultations" (click)="resume(item)">
            <ion-label class="ion-text-wrap">
              <strong>{{ item.patientName }}</strong>
              <p>{{ item.woundLabel || 'Telehealth consultation' }} · {{ item.providerName || 'Assigned provider' }}</p>
              <p>{{ item.startIso ? (item.startIso | date:'medium') : 'Date not recorded' }}</p>
            </ion-label>
            <ion-badge slot="end" [color]="statusColor(item.sessionState)">{{ statusLabel(item.sessionState) }}</ion-badge>
          </ion-item>
        </ion-list>
      </section>

      <section class="new-consult">
        <h2>New consultation</h2>
        <ion-item>
          <ion-label>Patient</ion-label>
          <ion-select [(ngModel)]="patientId" (ionChange)="onIntakeChanged(); loadWounds()" [disabled]="busy">
            <ion-select-option *ngFor="let p of patients" [value]="p.id">{{ p.name }}</ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-label>Wound</ion-label>
          <ion-select [(ngModel)]="woundId" (ionChange)="onIntakeChanged()" [disabled]="busy">
            <ion-select-option *ngFor="let w of wounds" [value]="w.id">{{ w.label }}</ion-select-option>
          </ion-select>
        </ion-item>
        <p *ngIf="patientId && !busy && !wounds.length">No persisted wound available. Complete the wound record first.</p>

        <ion-item>
          <ion-label>NP / Provider</ion-label>
          <ion-select [(ngModel)]="providerUid" (ionChange)="onIntakeChanged()" [disabled]="busy">
            <ion-select-option *ngFor="let p of providers" [value]="p.uid">{{ p.name }}</ion-select-option>
          </ion-select>
        </ion-item>
        <p *ngIf="!busy && !providers.length">No eligible provider is available in your organization.</p>

        <ion-textarea
          label="Reason for consultation"
          labelPlacement="stacked"
          [(ngModel)]="reason"
          (ionInput)="onIntakeChanged()"
          maxlength="500"
          [disabled]="busy">
        </ion-textarea>

        <p class="draft-state" *ngIf="draftStatus">{{ draftStatus }}</p>
        <ion-button expand="block"
          [disabled]="busy || !patientId || !woundId || !providerUid || reason.trim().length < 5"
          (click)="create()">Create consultation</ion-button>
      </section>
    </main></ion-content>`,
  styles: [`
    main{max-width:780px;margin:auto;padding:20px}.hero{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
    .eyebrow{font-size:10px;letter-spacing:.14em;font-weight:800;color:var(--ion-color-success)}
    h1{margin:2px 0 6px}.new-consult{margin-top:28px;padding-top:18px;border-top:1px solid var(--ion-color-light-shade)}
    p[role=alert]{color:var(--ion-color-danger)}ion-textarea{margin:18px 0}.draft-state{font-size:12px;color:var(--ion-color-medium)}
  `],
})
export class TelehealthPage implements OnInit {
  patients: Patient[] = [];
  providers: {uid: string; name: string}[] = [];
  wounds: {id: string; label: string}[] = [];
  consultations: MobileTelehealthAppointment[] = [];

  patientId = '';
  woundId = '';
  providerUid = '';
  reason = '';
  busy = false;
  error = '';
  draftStatus = '';
  private draftTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private patientService: PatientService,
    private service: TelehealthService,
    private drafts: ClinicalDraftService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    this.busy = true;
    try {
      [this.patients, this.providers, this.consultations] = await Promise.all([
        this.patientService.listPatients(),
        this.service.providers(),
        this.service.myConsultations(),
      ]);
      const patientId = this.route.snapshot.queryParamMap.get('patientId') || '';
      if (this.patients.some(p => p.id === patientId)) {
        this.patientId = patientId;
        await this.loadWounds();
        const woundId = this.route.snapshot.queryParamMap.get('woundId') || '';
        if (this.wounds.some(w => w.id === woundId)) this.woundId = woundId;
        await this.restoreIntakeDraft();
      }
    } catch (e: any) {
      this.error = e?.message || 'Unable to load Telehealth workspace.';
    } finally {
      this.busy = false;
    }
  }

  ionViewWillEnter(): void {
    void this.refreshConsultations();
  }

  async refreshConsultations(): Promise<void> {
    try {
      this.consultations = await this.service.myConsultations();
    } catch (e: any) {
      this.error = e?.message || 'Unable to load consultation history.';
    }
  }

  resume(item: MobileTelehealthAppointment): void {
    void this.router.navigate(['/tabs/telehealth/session', item.id]);
  }

  statusLabel(state: string): string {
    return ({
      not_started: 'Not started',
      scheduled: 'Scheduled',
      waiting: 'Waiting',
      in_progress: 'In progress',
      ended: 'Completed',
      cancelled: 'Cancelled',
      failed: 'Failed',
    } as Record<string, string>)[state] || state;
  }

  statusColor(state: string): string {
    if (state === 'in_progress' || state === 'waiting') return 'success';
    if (state === 'ended') return 'medium';
    if (state === 'cancelled' || state === 'failed') return 'danger';
    return 'primary';
  }

  async loadWounds(): Promise<void> {
    this.woundId = '';
    this.wounds = [];
    this.error = '';
    this.busy = true;
    try {
      if (this.patientId) this.wounds = await this.service.wounds(this.patientId);
    } catch (e: any) {
      this.error = e?.message || 'Unable to load wounds.';
    } finally {
      this.busy = false;
    }
  }

  onIntakeChanged(): void {
    if (!this.patientId) return;
    if (this.draftTimer) clearTimeout(this.draftTimer);
    this.draftTimer = setTimeout(() => void this.persistIntakeDraft(), 900);
  }

  private draftKey() {
    return {
      formKind: 'telehealth_intake' as const,
      patientId: this.patientId,
      contextKey: 'new-consultation',
    };
  }

  private async restoreIntakeDraft(): Promise<void> {
    if (!this.patientId) return;
    try {
      const saved = await this.drafts.load<any>(this.draftKey());
      if (!saved?.payload) return;
      const payload = saved.payload;
      this.providerUid = String(payload.providerUid || this.providerUid || '');
      this.reason = String(payload.reason || '');
      const savedWoundId = String(payload.woundId || '');
      if (savedWoundId && this.wounds.some((w) => w.id === savedWoundId)) this.woundId = savedWoundId;
      this.draftStatus = saved.updatedAt ? `Draft restored from ${new Date(saved.updatedAt).toLocaleString()}` : 'Draft restored';
    } catch {
      // Draft recovery must never block Telehealth.
    }
  }

  private async persistIntakeDraft(): Promise<void> {
    if (!this.patientId) return;
    try {
      await this.drafts.save(this.draftKey(), {
        woundId: this.woundId,
        providerUid: this.providerUid,
        reason: this.reason,
      });
      this.draftStatus = 'Draft saved';
    } catch {
      this.draftStatus = 'Draft not synced yet';
    }
  }

  async create(): Promise<void> {
    if (this.busy || !this.patientId || !this.woundId || !this.providerUid || this.reason.trim().length < 5) return;
    this.busy = true;
    this.error = '';
    try {
      const result = await this.service.create({
        patientId: this.patientId,
        woundId: this.woundId,
        providerUid: this.providerUid,
        reason: this.reason.trim(),
      });
      await this.drafts.clear(this.draftKey()).catch(() => undefined);
      await this.router.navigate(['/tabs/telehealth/session', result.appointmentId]);
    } catch (e: any) {
      this.error = e?.message || 'Consultation creation failed.';
    } finally {
      this.busy = false;
    }
  }
}
