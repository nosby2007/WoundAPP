import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonBadge, IonButton, IonCard, IonCardContent, IonContent, IonHeader, IonIcon,
  IonItem, IonLabel, IonSearchbar, IonSelect, IonSelectOption, IonSpinner,
  IonTitle, IonToolbar,
} from '@ionic/angular/standalone';
import { arrowForwardOutline, calendarOutline, documentTextOutline, personOutline, timeOutline } from 'ionicons/icons';
import { Patient, PatientService } from '../../services/patient.service';
import { VisitHistoryItem, VisitHistoryService } from '../../services/visit-history.service';

@Component({
  selector: 'app-visit-history',
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonContent,
    IonSearchbar, IonSelect, IonSelectOption, IonCard, IonCardContent, IonBadge,
    IonButton, IonIcon, IonItem, IonLabel, IonSpinner,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar><ion-title>Visit History</ion-title></ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="page">
        <section class="hero">
          <p class="eyebrow">CLINICAL VISIT RECORD</p>
          <h1>Patient visit history</h1>
          <p>Review the saved field visit, clinician, outcome, EVV checkpoints, and office-documentation handoff.</p>
        </section>

        <section class="patient-picker">
          <ion-searchbar [(ngModel)]="search" placeholder="Search patient" debounce="150"></ion-searchbar>
          <ion-select
            label="Patient"
            labelPlacement="stacked"
            interface="popover"
            [(ngModel)]="selectedPatientId"
            (ionChange)="loadVisits()"
            placeholder="Choose patient">
            <ion-select-option *ngFor="let patient of filteredPatients" [value]="patient.id">
              {{ patient.name }}<ng-container *ngIf="patient.mrn"> · {{ patient.mrn }}</ng-container>
            </ion-select-option>
          </ion-select>
        </section>

        <div class="state" *ngIf="loading"><ion-spinner></ion-spinner><p>Loading visit history…</p></div>
        <div class="status error" *ngIf="error">{{ error }}</div>

        <section *ngIf="!loading && selectedPatientId">
          <div class="section-head">
            <div><p class="eyebrow dark">TIMELINE</p><h2>{{ selectedPatientName }}</h2></div>
            <ion-badge color="primary">{{ visits.length }}</ion-badge>
          </div>

          <ion-card class="visit-card" *ngFor="let visit of visits" button="true" (click)="openVisit(visit)">
            <ion-card-content>
              <div class="visit-head">
                <div>
                  <span class="micro">{{ visit.visitType || 'visit' }}</span>
                  <h3>{{ statusLabel(visit) }}</h3>
                </div>
                <ion-badge [color]="statusColor(visit)">{{ statusLabel(visit) }}</ion-badge>
              </div>

              <div class="grid">
                <div><ion-icon [icon]="calendarOutline"></ion-icon><span>Scheduled</span><strong>{{ history.toDate(visit.scheduledFor) | date:'medium' }}</strong></div>
                <div><ion-icon [icon]="personOutline"></ion-icon><span>Clinician</span><strong>{{ visit.performedByName || visit.clinicianName || 'Not recorded' }}</strong></div>
                <div><ion-icon [icon]="timeOutline"></ion-icon><span>Field state</span><strong>{{ visit.fieldVisitState || visit.status || '—' }}</strong></div>
                <div><ion-icon [icon]="documentTextOutline"></ion-icon><span>Office documentation</span><strong>{{ visit.officeDocumentationState || '—' }}</strong></div>
              </div>

              <div class="reason" *ngIf="visit.notDoneReason">
                <strong>Not done reason</strong>
                <span>{{ visit.notDoneReason }}</span>
              </div>

              <div class="foot">
                <span>{{ visit.mobileWorkflow?.lastRoute || 'Saved clinical visit' }}</span>
                <ion-icon [icon]="arrowForwardOutline"></ion-icon>
              </div>
            </ion-card-content>
          </ion-card>

          <div class="empty" *ngIf="!visits.length">
            <strong>No saved visits</strong>
            <p>No wound visits were found for this patient.</p>
          </div>
        </section>
      </div>
    </ion-content>
  `,
  styles: [`
    :host{--ink:#10233f;--muted:#65778b;--green:#0b7551}ion-toolbar{--background:#fff;--color:var(--ink)}
    .page{padding:16px 16px 36px;background:#f4f7fa;min-height:100%}.hero{background:linear-gradient(145deg,#173d5c,#0b7251);color:#fff;border-radius:26px;padding:20px}
    .hero h1{margin:3px 0 6px;font-size:25px}.hero p{margin:0;opacity:.82}.eyebrow{font-size:10px;letter-spacing:.14em;font-weight:800;margin:0 0 5px}.eyebrow.dark{color:#587188}
    .patient-picker{margin:16px 0;background:#fff;border-radius:20px;padding:10px 14px}.patient-picker ion-searchbar{--box-shadow:none;padding:0}.patient-picker ion-select{padding:8px}
    .section-head{display:flex;justify-content:space-between;align-items:flex-end;margin:22px 4px 8px}.section-head h2{margin:0;color:var(--ink)}
    .visit-card{margin:10px 0;border-radius:21px;box-shadow:0 7px 24px rgba(30,55,75,.06)}.visit-head{display:flex;justify-content:space-between;gap:10px}.visit-head h3{margin:3px 0;color:var(--ink)}
    .micro{font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#577188;font-weight:800}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}
    .grid div{background:#f7fafc;border-radius:14px;padding:11px}.grid ion-icon{color:var(--green);font-size:17px}.grid span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:4px 0}.grid strong{font-size:12px;color:var(--ink)}
    .reason{margin-top:12px;background:#fff1f2;color:#9f1239;border-radius:13px;padding:10px}.reason strong,.reason span{display:block}.reason span{font-size:12px;margin-top:3px}
    .foot{border-top:1px solid #edf1f4;margin-top:13px;padding-top:11px;display:flex;justify-content:space-between;gap:10px;color:var(--muted);font-size:10px}.status{padding:12px;border-radius:12px}.status.error{background:#fff0f0;color:#9f1d1d}.state,.empty{text-align:center;padding:30px;color:var(--muted)}.empty{background:#fff;border-radius:18px}.empty strong{color:var(--ink)}
    @media(max-width:520px){.grid{grid-template-columns:1fr}}
  `],
})
export class VisitHistoryPage implements OnInit {
  readonly arrowForwardOutline = arrowForwardOutline;
  readonly calendarOutline = calendarOutline;
  readonly documentTextOutline = documentTextOutline;
  readonly personOutline = personOutline;
  readonly timeOutline = timeOutline;

  patients: Patient[] = [];
  visits: VisitHistoryItem[] = [];
  selectedPatientId = '';
  search = '';
  loading = false;
  error = '';

  constructor(
    private patientsService: PatientService,
    public history: VisitHistoryService,
    private router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      this.patients = await this.patientsService.listPatients(300);
    } catch (error: any) {
      this.error = error?.message || 'Unable to load patients.';
    }
  }

  get filteredPatients(): Patient[] {
    const q = this.search.trim().toLowerCase();
    if (!q) return this.patients;
    return this.patients.filter(p => [p.name, p.mrn, p.room].some(value => String(value || '').toLowerCase().includes(q)));
  }

  get selectedPatientName(): string {
    return this.patients.find(p => p.id === this.selectedPatientId)?.name || 'Patient';
  }

  async loadVisits(): Promise<void> {
    if (!this.selectedPatientId) { this.visits = []; return; }
    this.loading = true;
    this.error = '';
    try {
      this.visits = await this.history.listPatientVisits(this.selectedPatientId);
    } catch (error: any) {
      this.visits = [];
      this.error = error?.message || 'Unable to load visit history.';
    } finally {
      this.loading = false;
    }
  }

  openVisit(visit: VisitHistoryItem): void {
    void this.router.navigate(['/tabs/visit-history', this.selectedPatientId, visit.id]);
  }

  statusLabel(visit: VisitHistoryItem): string {
    if (visit.fieldVisitState === 'not_done' || visit.status === 'missed') return 'Not done';
    if (visit.fieldVisitState === 'completed' || visit.status === 'completed') return 'Completed';
    if (visit.fieldVisitState === 'on_site' || (!!visit.checkIn && !visit.checkOut)) return 'On site';
    return 'Scheduled';
  }

  statusColor(visit: VisitHistoryItem): string {
    const label = this.statusLabel(visit);
    return label === 'Not done' ? 'danger' : label === 'Completed' ? 'success' : label === 'On site' ? 'warning' : 'primary';
  }
}
