import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonBadge, IonButton, IonCard, IonCardContent, IonContent, IonHeader, IonIcon,
  IonInput, IonItem, IonSelect, IonSelectOption, IonSpinner, IonTitle, IonToolbar,
} from '@ionic/angular/standalone';
import {
  calendarOutline, createOutline, personAddOutline, refreshOutline,
  repeatOutline, timeOutline,
} from 'ionicons/icons';
import {
  MobileSchedulerService, SchedulerStaffOption, TeamScheduleVisit,
} from '../../services/mobile-scheduler.service';
import { Patient, PatientService } from '../../services/patient.service';

type EditorMode = 'new' | 'edit' | 'replan';

@Component({
  selector: 'app-scheduler-workspace',
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonContent,
    IonCard, IonCardContent, IonButton, IonIcon, IonBadge, IonSpinner,
    IonItem, IonInput, IonSelect, IonSelectOption,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar><ion-title>Scheduler</ion-title></ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="page">
        <section class="hero">
          <p class="eyebrow">OPERATIONS</p>
          <h1>Scheduling workspace</h1>
          <p>Plan, reschedule and reassign field visits from mobile without opening clinical documentation.</p>
          <div class="actions">
            <ion-button color="light" (click)="newAppointment()">
              <ion-icon slot="start" [icon]="calendarOutline"></ion-icon>New appointment
            </ion-button>
            <ion-button fill="outline" color="light" (click)="newPatient()">
              <ion-icon slot="start" [icon]="personAddOutline"></ion-icon>New patient
            </ion-button>
            <ion-button fill="clear" color="light" (click)="load()">
              <ion-icon slot="start" [icon]="refreshOutline"></ion-icon>Refresh
            </ion-button>
          </div>
        </section>

        <ion-card class="editor" *ngIf="editorOpen">
          <ion-card-content>
            <div class="editor-head">
              <div>
                <p class="eyebrow dark">{{ editorMode === 'edit' ? 'EDIT SCHEDULED VISIT' : editorMode === 'replan' ? 'REPLAN VISIT' : 'NEW APPOINTMENT' }}</p>
                <h2>{{ editorMode === 'edit' ? 'Reschedule / reassign' : 'Plan appointment' }}</h2>
              </div>
              <ion-badge color="primary">{{ editorMode }}</ion-badge>
            </div>

            <ion-item lines="none">
              <ion-select
                label="Patient"
                labelPlacement="stacked"
                [(ngModel)]="form.patientId"
                [disabled]="editorMode === 'edit'"
                placeholder="Choose patient"
                (ionChange)="syncPatientName()">
                <ion-select-option *ngFor="let patient of patients" [value]="patient.id">{{ patient.name }}</ion-select-option>
              </ion-select>
            </ion-item>

            <ion-item lines="none">
              <ion-select
                label="Assign staff"
                labelPlacement="stacked"
                [(ngModel)]="form.assignedToUid"
                placeholder="Choose staff"
                (ionChange)="syncStaff()">
                <ion-select-option *ngFor="let staff of staffOptions" [value]="staff.uid">
                  {{ staff.displayName }} · {{ roleLabel(staff.role) }}
                </ion-select-option>
              </ion-select>
            </ion-item>

            <div class="form-grid">
              <ion-item lines="none">
                <ion-input label="Start" labelPlacement="stacked" type="datetime-local" [(ngModel)]="form.start"></ion-input>
              </ion-item>
              <ion-item lines="none">
                <ion-input label="End" labelPlacement="stacked" type="datetime-local" [(ngModel)]="form.end"></ion-input>
              </ion-item>
            </div>

            <ion-item lines="none">
              <ion-select label="Visit type" labelPlacement="stacked" [(ngModel)]="form.visitType">
                <ion-select-option value="routine">Routine visit</ion-select-option>
                <ion-select-option value="wound_follow_up">Wound follow-up</ion-select-option>
                <ion-select-option value="post_hospital">Post-hospital visit</ion-select-option>
                <ion-select-option value="adl">ADL / Personal care</ion-select-option>
                <ion-select-option value="companion">Companion activity</ion-select-option>
                <ion-select-option value="other">Other</ion-select-option>
              </ion-select>
            </ion-item>

            <div class="editor-actions">
              <ion-button expand="block" [disabled]="saving" (click)="saveAppointment()">
                <ion-spinner *ngIf="saving" name="crescent"></ion-spinner>
                <span *ngIf="!saving">{{ editorMode === 'edit' ? 'Save changes' : editorMode === 'replan' ? 'Create replanned visit' : 'Create appointment' }}</span>
              </ion-button>
              <ion-button expand="block" fill="outline" color="medium" [disabled]="saving" (click)="closeEditor()">Cancel</ion-button>
            </div>
            <div class="success" *ngIf="message">{{ message }}</div>
          </ion-card-content>
        </ion-card>

        <section class="section-head">
          <div><p class="eyebrow dark">NEXT 14 DAYS</p><h2>Team schedule</h2></div>
          <ion-badge color="primary">{{ visits.length }}</ion-badge>
        </section>

        <div class="state" *ngIf="loading"><ion-spinner></ion-spinner><span>Loading schedule…</span></div>
        <div class="error" *ngIf="error">{{ error }}</div>

        <ion-card *ngFor="let visit of visits" class="visit" [class.visit-alert]="visit.status === 'not_done'">
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
              <div><ion-icon [icon]="timeOutline"></ion-icon><span>{{ visit.assignedToName || 'Unassigned' }}<ng-container *ngIf="visit.assignedToRole"> · {{ roleLabel(visit.assignedToRole) }}</ng-container></span></div>
            </div>

            <div class="reason" *ngIf="visit.statusReason">{{ visit.statusReason }}</div>

            <div class="visit-actions" *ngIf="visit.status === 'scheduled'">
              <ion-button size="small" fill="outline" (click)="editAppointment(visit)">
                <ion-icon slot="start" [icon]="createOutline"></ion-icon>Reschedule / reassign
              </ion-button>
            </div>

            <div class="visit-actions" *ngIf="visit.status === 'not_done' || visit.status === 'canceled'">
              <ion-button size="small" color="warning" fill="outline" (click)="replanAppointment(visit)">
                <ion-icon slot="start" [icon]="repeatOutline"></ion-icon>Replan
              </ion-button>
              <span class="linked-note" *ngIf="visit.nextAppointmentId">Follow-up already linked</span>
            </div>
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
    .editor{margin:16px 0;border-radius:22px}.editor-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.editor h2{margin:3px 0 12px;color:var(--ink)}
    .editor ion-item{--background:#f7fafc;border-radius:14px;margin:8px 0}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.editor-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.success{margin-top:10px;background:#ecfdf5;color:#166534;border-radius:12px;padding:10px;font-size:12px}
    .visit{margin:10px 0;border-radius:20px;box-shadow:0 7px 22px rgba(30,55,75,.06)}.visit-alert{border-left:4px solid #c2413b}.row{display:flex;justify-content:space-between;gap:12px}.row strong{display:block;color:var(--ink);font-size:16px}.row span{display:block;color:var(--muted);font-size:11px;margin-top:3px}
    .meta{display:grid;gap:8px;margin-top:13px;padding-top:12px;border-top:1px solid #edf1f4}.meta div{display:flex;gap:8px;align-items:center;color:#40566c;font-size:12px}.meta ion-icon{color:var(--green)}
    .reason{margin-top:10px;padding:9px 11px;border-radius:12px;background:#fff1f2;color:#9f1239;font-size:12px}.visit-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px}.linked-note{font-size:10px;color:#64748b}
    .state{text-align:center;padding:30px;color:var(--muted);display:grid;gap:8px;justify-items:center}.error{padding:12px;border-radius:14px;background:#fff1f2;color:#9f1239}
    @media(max-width:620px){.form-grid,.editor-actions{grid-template-columns:1fr}}
  `]
})
export class SchedulerWorkspacePage implements OnInit {
  readonly calendarOutline = calendarOutline;
  readonly createOutline = createOutline;
  readonly personAddOutline = personAddOutline;
  readonly refreshOutline = refreshOutline;
  readonly repeatOutline = repeatOutline;
  readonly timeOutline = timeOutline;

  visits: TeamScheduleVisit[] = [];
  patients: Patient[] = [];
  staffOptions: SchedulerStaffOption[] = [];
  loading = true;
  saving = false;
  error = '';
  message = '';

  editorOpen = false;
  editorMode: EditorMode = 'new';
  editingAppointmentId: string | null = null;
  sourceAppointmentId: string | null = null;

  form = {
    patientId: '',
    patientName: '',
    assignedToUid: '',
    assignedToName: '',
    assignedToRole: '',
    start: '',
    end: '',
    visitType: 'routine',
  };

  constructor(
    public scheduler: MobileSchedulerService,
    private patientsService: PatientService,
    private router: Router,
  ) {}

  ngOnInit(): void { void this.load(); }

  async load(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      const [visits, patients, staff] = await Promise.all([
        this.scheduler.upcoming(14),
        this.patientsService.listPatients(300),
        this.scheduler.listAssignableStaff(),
      ]);
      this.visits = visits;
      this.patients = patients;
      this.staffOptions = staff;
    } catch (error: any) {
      this.error = error?.message || 'Unable to load the team schedule.';
    } finally {
      this.loading = false;
    }
  }

  newPatient(): void { void this.router.navigate(['/tabs/add-patient']); }

  newAppointment(): void {
    this.resetEditor('new');
    this.editorOpen = true;
  }

  editAppointment(visit: TeamScheduleVisit): void {
    if (visit.status !== 'scheduled') return;
    this.editorMode = 'edit';
    this.editorOpen = true;
    this.editingAppointmentId = visit.id;
    this.sourceAppointmentId = null;
    this.form = {
      patientId: visit.patientId || '',
      patientName: visit.patientName || '',
      assignedToUid: visit.assignedToUid || '',
      assignedToName: visit.assignedToName || '',
      assignedToRole: visit.assignedToRole || '',
      start: this.toLocalInput(this.scheduler.toDate(visit.start)),
      end: this.toLocalInput(this.scheduler.toDate(visit.end) || this.addMinutes(this.scheduler.toDate(visit.start), 60)),
      visitType: visit.visitType || 'routine',
    };
  }

  replanAppointment(visit: TeamScheduleVisit): void {
    this.resetEditor('replan');
    this.sourceAppointmentId = visit.id;
    this.form.patientId = visit.patientId || '';
    this.form.patientName = visit.patientName || '';
    this.form.assignedToUid = visit.assignedToUid || '';
    this.form.assignedToName = visit.assignedToName || '';
    this.form.assignedToRole = visit.assignedToRole || '';
    this.form.visitType = visit.visitType || 'routine';
    this.editorOpen = true;
  }

  closeEditor(): void {
    this.editorOpen = false;
    this.message = '';
    this.error = '';
  }

  syncPatientName(): void {
    const patient = this.patients.find(item => item.id === this.form.patientId);
    this.form.patientName = patient?.name || '';
  }

  syncStaff(): void {
    const staff = this.staffOptions.find(item => item.uid === this.form.assignedToUid);
    this.form.assignedToName = staff?.displayName || '';
    this.form.assignedToRole = staff?.role || '';
  }

  async saveAppointment(): Promise<void> {
    if (this.saving) return;
    this.syncPatientName();
    this.syncStaff();

    const start = new Date(this.form.start);
    const end = new Date(this.form.end);
    if (!this.form.patientId || !this.form.assignedToUid) {
      this.error = 'Choose both a patient and assigned staff member.';
      return;
    }

    this.saving = true;
    this.error = '';
    this.message = '';
    try {
      if (this.editorMode === 'edit' && this.editingAppointmentId) {
        await this.scheduler.updateScheduledAppointment(this.editingAppointmentId, {
          assignedToUid: this.form.assignedToUid,
          assignedToName: this.form.assignedToName,
          assignedToRole: this.form.assignedToRole,
          start,
          end,
          visitType: this.form.visitType,
        });
        this.message = 'Appointment rescheduled and staff assignment updated.';
      } else {
        await this.scheduler.createAppointment({
          patientId: this.form.patientId,
          patientName: this.form.patientName,
          assignedToUid: this.form.assignedToUid,
          assignedToName: this.form.assignedToName,
          assignedToRole: this.form.assignedToRole,
          start,
          end,
          visitType: this.form.visitType,
          workflowKind: this.form.visitType === 'wound_follow_up' ? 'wound' : 'general',
          sourceAppointmentId: this.editorMode === 'replan' ? this.sourceAppointmentId : null,
        });
        this.message = this.editorMode === 'replan'
          ? 'Replacement appointment created and linked to the prior visit.'
          : 'Appointment created.';
      }

      await this.load();
      setTimeout(() => this.closeEditor(), 700);
    } catch (error: any) {
      this.error = error?.message || 'Unable to save this appointment.';
    } finally {
      this.saving = false;
    }
  }

  statusColor(status?: string | null): string {
    if (status === 'completed') return 'success';
    if (status === 'not_done' || status === 'canceled') return 'danger';
    return 'primary';
  }

  roleLabel(role?: string | null): string {
    return String(role || '').replace(/_/g, ' ').toUpperCase();
  }

  private resetEditor(mode: EditorMode): void {
    const start = this.roundToNextQuarter(new Date(Date.now() + 60 * 60 * 1000));
    const end = this.addMinutes(start, 60);
    this.editorMode = mode;
    this.editingAppointmentId = null;
    this.sourceAppointmentId = null;
    this.message = '';
    this.error = '';
    this.form = {
      patientId: '',
      patientName: '',
      assignedToUid: '',
      assignedToName: '',
      assignedToRole: '',
      start: this.toLocalInput(start),
      end: this.toLocalInput(end),
      visitType: 'routine',
    };
  }

  private isSupportVisitType(type: string): boolean {
    return ['adl', 'companion'].includes(type);
  }

  private roundToNextQuarter(date: Date): Date {
    const result = new Date(date);
    result.setSeconds(0, 0);
    result.setMinutes(Math.ceil(result.getMinutes() / 15) * 15);
    return result;
  }

  private addMinutes(date: Date | null, minutes: number): Date {
    const base = date ? new Date(date) : new Date();
    return new Date(base.getTime() + minutes * 60 * 1000);
  }

  private toLocalInput(date: Date | null): string {
    if (!date) return '';
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
}
