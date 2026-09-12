import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBadge, IonButton, IonCard, IonCardContent, IonContent, IonHeader, IonIcon,
  IonSpinner, IonTitle, IonToolbar,
} from '@ionic/angular/standalone';
import { calendarOutline, personAddOutline, refreshOutline, timeOutline } from 'ionicons/icons';
import { MobileSchedulerService, TeamScheduleVisit } from '../../services/mobile-scheduler.service';

@Component({
  selector: 'app-scheduler-workspace',
  standalone: true,
  imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardContent, IonButton, IonIcon, IonBadge, IonSpinner],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar><ion-title>Scheduler</ion-title></ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="page">
        <section class="hero">
          <p class="eyebrow">OPERATIONS</p>
          <h1>Scheduling workspace</h1>
          <p>Register patients and review the team visit schedule without opening clinical documentation.</p>
          <div class="actions">
            <ion-button color="light" (click)="newPatient()"><ion-icon slot="start" [icon]="personAddOutline"></ion-icon>New patient</ion-button>
            <ion-button fill="outline" color="light" (click)="load()"><ion-icon slot="start" [icon]="refreshOutline"></ion-icon>Refresh</ion-button>
          </div>
        </section>

        <section class="section-head">
          <div><p class="eyebrow dark">NEXT 14 DAYS</p><h2>Team schedule</h2></div>
          <ion-badge color="primary">{{ visits.length }}</ion-badge>
        </section>

        <div class="state" *ngIf="loading"><ion-spinner></ion-spinner><span>Loading schedule…</span></div>
        <div class="error" *ngIf="error">{{ error }}</div>

        <ion-card *ngFor="let visit of visits" class="visit">
          <ion-card-content>
            <div class="row">
              <div>
                <strong>{{ visit.patientName || 'Patient' }}</strong>
                <span>{{ visit.visitType || visit.workflowKind || 'Visit' }}</span>
              </div>
              <ion-badge [color]="statusColor(visit.status)">{{ visit.status || 'scheduled' }}</ion-badge>
            </div>
            <div class="meta">
              <div><ion-icon [icon]="calendarOutline"></ion-icon><span>{{ scheduler.toDate(visit.start) | date:'medium' }}</span></div>
              <div><ion-icon [icon]="timeOutline"></ion-icon><span>{{ visit.assignedToName || 'Unassigned' }}<ng-container *ngIf="visit.assignedToRole"> · {{ visit.assignedToRole }}</ng-container></span></div>
            </div>
            <div class="reason" *ngIf="visit.statusReason">{{ visit.statusReason }}</div>
          </ion-card-content>
        </ion-card>

        <div class="state" *ngIf="!loading && !visits.length && !error">No upcoming visits in this window.</div>
      </div>
    </ion-content>
  `,
  styles: [`
    :host{--ink:#10233f;--muted:#64748b;--green:#0b7551}ion-toolbar{--background:#fff;--color:var(--ink)}
    .page{min-height:100%;padding:16px 16px 36px;background:#f4f7fa}.hero{padding:22px;border-radius:26px;color:#fff;background:linear-gradient(145deg,#173d5c,#0b7251)}
    .hero h1{font-size:26px;margin:4px 0 6px}.hero p{margin:0;opacity:.83}.eyebrow{font-size:10px;letter-spacing:.15em;font-weight:800;margin:0}.eyebrow.dark{color:#587188}
    .actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:17px}.section-head{display:flex;align-items:end;justify-content:space-between;margin:23px 4px 8px}.section-head h2{margin:2px 0 0;color:var(--ink)}
    .visit{margin:10px 0;border-radius:20px;box-shadow:0 7px 22px rgba(30,55,75,.06)}.row{display:flex;justify-content:space-between;gap:12px}.row strong{display:block;color:var(--ink);font-size:16px}.row span{display:block;color:var(--muted);font-size:11px;margin-top:3px}
    .meta{display:grid;gap:8px;margin-top:13px;padding-top:12px;border-top:1px solid #edf1f4}.meta div{display:flex;gap:8px;align-items:center;color:#40566c;font-size:12px}.meta ion-icon{color:var(--green)}
    .reason{margin-top:10px;padding:9px 11px;border-radius:12px;background:#fff1f2;color:#9f1239;font-size:12px}.state{text-align:center;padding:30px;color:var(--muted);display:grid;gap:8px;justify-items:center}.error{padding:12px;border-radius:14px;background:#fff1f2;color:#9f1239}
  `]
})
export class SchedulerWorkspacePage implements OnInit {
  readonly calendarOutline = calendarOutline;
  readonly personAddOutline = personAddOutline;
  readonly refreshOutline = refreshOutline;
  readonly timeOutline = timeOutline;

  visits: TeamScheduleVisit[] = [];
  loading = true;
  error = '';

  constructor(public scheduler: MobileSchedulerService, private router: Router) {}

  ngOnInit(): void { void this.load(); }

  async load(): Promise<void> {
    this.loading = true;
    this.error = '';
    try { this.visits = await this.scheduler.upcoming(14); }
    catch (error: any) { this.error = error?.message || 'Unable to load the team schedule.'; }
    finally { this.loading = false; }
  }

  newPatient(): void { void this.router.navigate(['/tabs/add-patient']); }

  statusColor(status?: string | null): string {
    if (status === 'completed') return 'success';
    if (status === 'not_done' || status === 'canceled') return 'danger';
    return 'primary';
  }
}
