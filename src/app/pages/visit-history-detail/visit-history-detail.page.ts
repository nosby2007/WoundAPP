import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBadge, IonButton, IonCard, IonCardContent, IonContent, IonHeader, IonIcon,
  IonSpinner, IonTitle, IonToolbar,
} from '@ionic/angular/standalone';
import { arrowBackOutline, documentTextOutline, folderOpenOutline, locationOutline, personOutline, timeOutline } from 'ionicons/icons';
import { VisitHistoryItem, VisitHistoryService } from '../../services/visit-history.service';

@Component({
  selector: 'app-visit-history-detail',
  standalone: true,
  imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonIcon, IonCard, IonCardContent, IonBadge, IonSpinner],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-button fill="clear" slot="start" (click)="back()"><ion-icon [icon]="arrowBackOutline"></ion-icon></ion-button>
        <ion-title>Visit Details</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="page" *ngIf="visit; else stateTpl">
        <section class="hero">
          <div>
            <p class="eyebrow">SAVED FIELD VISIT</p>
            <h1>{{ statusLabel }}</h1>
            <p>{{ visit.visitType || 'Clinical visit' }} · {{ history.toDate(visit.scheduledFor) | date:'medium' }}</p>
          </div>
          <ion-badge [color]="statusColor">{{ statusLabel }}</ion-badge>
        </section>

        <ion-card>
          <ion-card-content>
            <h2>Field execution</h2>
            <div class="rows">
              <div><ion-icon [icon]="personOutline"></ion-icon><span>Assigned clinician</span><strong>{{ visit.clinicianName || '—' }}<ng-container *ngIf="visit.clinicianRole"> · {{ visit.clinicianRole }}</ng-container></strong></div>
              <div><ion-icon [icon]="personOutline"></ion-icon><span>Actual performer</span><strong>{{ visit.performedByName || '—' }}<ng-container *ngIf="visit.performedByRole"> · {{ visit.performedByRole }}</ng-container></strong></div>
              <div><ion-icon [icon]="timeOutline"></ion-icon><span>Check in</span><strong>{{ checkpoint(visit.checkIn) }}</strong></div>
              <div><ion-icon [icon]="timeOutline"></ion-icon><span>Check out</span><strong>{{ checkpoint(visit.checkOut) }}</strong></div>
              <div><ion-icon [icon]="locationOutline"></ion-icon><span>Place of service</span><strong>{{ visit.placeOfService || '—' }}</strong></div>
            </div>

            <div class="reason" *ngIf="visit.notDoneReason">
              <strong>Visit not done</strong>
              <p>{{ visit.notDoneReason }}</p>
              <span>{{ history.toDate(visit.notDoneAt) | date:'medium' }}</span>
            </div>
          </ion-card-content>
        </ion-card>

        <ion-card>
          <ion-card-content>
            <h2>Workflow & documentation</h2>
            <div class="rows">
              <div><ion-icon [icon]="documentTextOutline"></ion-icon><span>Field state</span><strong>{{ visit.fieldVisitState || visit.status || '—' }}</strong></div>
              <div><ion-icon [icon]="documentTextOutline"></ion-icon><span>Office documentation</span><strong>{{ visit.officeDocumentationState || '—' }}</strong></div>
              <div><ion-icon [icon]="folderOpenOutline"></ion-icon><span>Last mobile step</span><strong>{{ visit.mobileWorkflow?.currentStep || '—' }}</strong></div>
              <div><ion-icon [icon]="folderOpenOutline"></ion-icon><span>Last mobile route</span><strong>{{ visit.mobileWorkflow?.lastRoute || '—' }}</strong></div>
            </div>
            <div class="narrative" *ngIf="visit.summary || visit.nextStep">
              <div *ngIf="visit.summary"><span>Visit summary</span><p>{{ visit.summary }}</p></div>
              <div *ngIf="visit.nextStep"><span>Next step</span><p>{{ visit.nextStep }}</p></div>
            </div>
          </ion-card-content>
        </ion-card>

        <ion-card>
          <ion-card-content>
            <h2>Record linkage</h2>
            <div class="rows compact">
              <div><span>Visit ID</span><strong>{{ visit.id }}</strong></div>
              <div><span>Appointment ID</span><strong>{{ visit.appointmentId || '—' }}</strong></div>
              <div><span>Episode ID</span><strong>{{ visit.episodeId || '—' }}</strong></div>
              <div><span>Wound ID</span><strong>{{ visit.woundId || '—' }}</strong></div>
            </div>
          </ion-card-content>
        </ion-card>

        <ion-button expand="block" (click)="openChart()">Open patient clinical command</ion-button>
      </div>

      <ng-template #stateTpl>
        <div class="state" *ngIf="loading"><ion-spinner></ion-spinner><p>Loading saved visit…</p></div>
        <div class="state" *ngIf="!loading"><h2>Visit unavailable</h2><p>{{ error || 'This visit could not be loaded.' }}</p><ion-button (click)="back()">Back</ion-button></div>
      </ng-template>
    </ion-content>
  `,
  styles: [`
    :host{--ink:#10233f;--muted:#65778b;--green:#0b7551}ion-toolbar{--background:#fff;--color:var(--ink)}.page{padding:16px 16px 34px;background:#f4f7fa;min-height:100%}
    .hero{display:flex;justify-content:space-between;gap:14px;background:linear-gradient(145deg,#173d5c,#0b7251);color:#fff;border-radius:26px;padding:20px}.hero h1{margin:3px 0;font-size:25px}.hero p{margin:0;opacity:.8}.eyebrow{font-size:10px;letter-spacing:.14em;font-weight:800;margin:0}
    ion-card{border-radius:20px;margin:12px 0}h2{color:var(--ink);font-size:18px;margin:0 0 12px}.rows{display:grid;gap:9px}.rows>div{display:grid;grid-template-columns:24px 130px 1fr;gap:8px;align-items:start;border-bottom:1px solid #edf1f4;padding:9px 0}.rows.compact>div{grid-template-columns:130px 1fr}.rows ion-icon{color:var(--green);font-size:18px}.rows span,.narrative span{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}.rows strong{font-size:12px;color:var(--ink);word-break:break-word}
    .reason{margin-top:14px;background:#fff1f2;border-radius:14px;padding:12px;color:#9f1239}.reason p{margin:4px 0}.reason span{font-size:10px}.narrative{margin-top:15px}.narrative>div{background:#f8fafc;border-radius:14px;padding:12px;margin:8px 0}.narrative p{margin:5px 0 0;color:#30475d}.state{min-height:70vh;display:grid;place-items:center;align-content:center;text-align:center;color:var(--muted);padding:28px}
    @media(max-width:520px){.rows>div,.rows.compact>div{grid-template-columns:24px 1fr}.rows>div span,.rows.compact>div span{grid-column:2}.rows>div strong,.rows.compact>div strong{grid-column:2}}
  `],
})
export class VisitHistoryDetailPage implements OnInit {
  readonly arrowBackOutline = arrowBackOutline;
  readonly documentTextOutline = documentTextOutline;
  readonly folderOpenOutline = folderOpenOutline;
  readonly locationOutline = locationOutline;
  readonly personOutline = personOutline;
  readonly timeOutline = timeOutline;

  patientId = '';
  visitId = '';
  visit: VisitHistoryItem | null = null;
  loading = true;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public history: VisitHistoryService,
  ) {}

  async ngOnInit(): Promise<void> {
    this.patientId = this.route.snapshot.paramMap.get('patientId') || '';
    this.visitId = this.route.snapshot.paramMap.get('visitId') || '';
    try {
      this.visit = await this.history.getVisit(this.patientId, this.visitId);
      if (!this.visit) this.error = 'Saved visit not found.';
    } catch (error: any) {
      this.error = error?.message || 'Unable to load the visit.';
    } finally {
      this.loading = false;
    }
  }

  get statusLabel(): string {
    const visit = this.visit;
    if (!visit) return 'Visit';
    if (visit.fieldVisitState === 'not_done' || visit.status === 'missed') return 'Not done';
    if (visit.fieldVisitState === 'completed' || visit.status === 'completed') return 'Completed';
    if (visit.fieldVisitState === 'on_site' || (!!visit.checkIn && !visit.checkOut)) return 'On site';
    return 'Scheduled';
  }

  get statusColor(): string {
    return this.statusLabel === 'Not done' ? 'danger' : this.statusLabel === 'Completed' ? 'success' : this.statusLabel === 'On site' ? 'warning' : 'primary';
  }

  checkpoint(value: any): string {
    const date = this.history.toDate(value?.at);
    const by = value?.byName ? ` · ${value.byName}` : '';
    return date ? `${date.toLocaleString()}${by}` : 'Not recorded';
  }

  back(): void { void this.router.navigate(['/tabs/visit-history']); }
  openChart(): void { void this.router.navigate(['/tabs/skin-wound', this.patientId, 'assessments']); }
}
