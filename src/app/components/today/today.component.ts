import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { FieldTask, FieldVisit, FieldWorkService } from 'src/app/SERVICE/field-work.service';

@Component({
  selector: 'app-today',
  standalone: true,
  imports: [CommonModule, RouterModule, MatButtonModule, MatCardModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <section class="today-shell" *ngIf="fieldWork.today$ | async as day; else loadingTpl">
      <header class="hero">
        <div>
          <div class="eyebrow">FIELD WORKSPACE</div>
          <h1>Today</h1>
          <p>Your assigned home visits and tasks, in one place.</p>
        </div>
        <div class="summary">
          <div><strong>{{ day.visits.length }}</strong><span>Visits</span></div>
          <div><strong>{{ day.overdueTasks.length }}</strong><span>Overdue</span></div>
          <div><strong>{{ day.dueTodayTasks.length }}</strong><span>Tasks</span></div>
        </div>
      </header>

      <section class="section-block">
        <div class="section-head">
          <div><span class="kicker">ROUTE</span><h2>Today's visits</h2></div>
          <span class="count">{{ day.visits.length }}</span>
        </div>

        <div class="empty" *ngIf="!day.visits.length">No assigned visits for today.</div>

        <article class="visit-card" *ngFor="let visit of day.visits; trackBy: trackVisit">
          <div class="visit-time">
            <span>{{ fieldWork.toDate(visit.start) | date:'h:mm a' }}</span>
            <small>{{ visit.status | titlecase }}</small>
          </div>
          <div class="visit-main">
            <h3>{{ visit.patientName || visit.patient?.name || 'Patient' }}</h3>
            <p class="type">{{ visit.visitType || visit.appointmentDetails || 'Home visit' }}</p>
            <div class="meta" *ngIf="addressForVisit(visit) as address">
              <mat-icon>place</mat-icon><span>{{ address }}</span>
            </div>
            <div class="meta" *ngIf="phoneForVisit(visit) as phone">
              <mat-icon>phone</mat-icon><span>{{ phone }}</span>
            </div>
          </div>
          <div class="visit-actions">
            <button mat-stroked-button type="button" (click)="directions(addressForVisit(visit))" [disabled]="!addressForVisit(visit)">
              <mat-icon>directions</mat-icon>Directions
            </button>
            <button mat-stroked-button type="button" (click)="call(phoneForVisit(visit))" [disabled]="!phoneForVisit(visit)">
              <mat-icon>call</mat-icon>Call
            </button>
            <button mat-stroked-button type="button" (click)="openPatient(visit.patientId)" [disabled]="!visit.patientId">
              <mat-icon>folder_shared</mat-icon>Chart
            </button>
            <button mat-flat-button color="primary" type="button" (click)="completeVisit(visit)" [disabled]="busyId === visit.id || visit.status === 'completed'">
              <mat-icon>check_circle</mat-icon>{{ visit.status === 'completed' ? 'Completed' : 'Complete' }}
            </button>
          </div>
        </article>
      </section>

      <section class="section-block" *ngIf="day.overdueTasks.length">
        <div class="section-head danger"><div><span class="kicker">ATTENTION</span><h2>Overdue tasks</h2></div><span class="count">{{ day.overdueTasks.length }}</span></div>
        <ng-container *ngTemplateOutlet="taskList; context: { $implicit: day.overdueTasks }"></ng-container>
      </section>

      <section class="section-block">
        <div class="section-head"><div><span class="kicker">WORK QUEUE</span><h2>Due today</h2></div><span class="count">{{ day.dueTodayTasks.length }}</span></div>
        <div class="empty" *ngIf="!day.dueTodayTasks.length">No open tasks due today.</div>
        <ng-container *ngTemplateOutlet="taskList; context: { $implicit: day.dueTodayTasks }"></ng-container>
      </section>

      <section class="section-block completed" *ngIf="day.completedTodayTasks.length">
        <div class="section-head"><div><span class="kicker">DONE</span><h2>Completed today</h2></div><span class="count">{{ day.completedTodayTasks.length }}</span></div>
        <ng-container *ngTemplateOutlet="taskList; context: { $implicit: day.completedTodayTasks }"></ng-container>
      </section>

      <ng-template #taskList let-tasks>
        <article class="task-row" *ngFor="let task of tasks; trackBy: trackTask">
          <div class="task-status"><mat-icon>{{ task.status === 'done' ? 'task_alt' : 'radio_button_unchecked' }}</mat-icon></div>
          <div class="task-main">
            <h3>{{ task.title }}</h3>
            <p>{{ task.patient?.name || 'Patient' }}</p>
            <div class="meta" *ngIf="task.patient?.address"><mat-icon>place</mat-icon><span>{{ task.patient?.address }}</span></div>
            <div class="meta" *ngIf="fieldWork.toDate(task.dueAt) as due"><mat-icon>schedule</mat-icon><span>{{ due | date:'MMM d, h:mm a' }}</span></div>
          </div>
          <div class="task-actions">
            <button mat-stroked-button type="button" (click)="directions(task.patient?.address || '')" [disabled]="!task.patient?.address"><mat-icon>directions</mat-icon>Map</button>
            <button mat-stroked-button type="button" (click)="openPatient(task.patientId)"><mat-icon>folder_shared</mat-icon>Chart</button>
            <button mat-flat-button color="primary" type="button" (click)="completeTask(task)" [disabled]="busyId === task.id || task.status === 'done'">
              <mat-icon>done</mat-icon>{{ task.status === 'done' ? 'Done' : 'Mark done' }}
            </button>
          </div>
        </article>
      </ng-template>

      <div class="error-banner" *ngIf="errorText">{{ errorText }}</div>
    </section>

    <ng-template #loadingTpl><div class="loading"><mat-spinner diameter="42"></mat-spinner></div></ng-template>
  `,
  styles: [`
    :host{display:block;background:#f4f7f6;min-height:100vh;padding:18px 14px 96px;color:#12352b}.today-shell{max-width:920px;margin:0 auto}.hero{background:linear-gradient(135deg,#0f5132,#198754);color:#fff;border-radius:24px;padding:24px;display:flex;justify-content:space-between;gap:18px;align-items:end;box-shadow:0 14px 34px rgba(15,81,50,.18)}.eyebrow,.kicker{font-size:11px;font-weight:800;letter-spacing:.12em;opacity:.75}.hero h1{font-size:34px;margin:4px 0}.hero p{margin:0;opacity:.9}.summary{display:flex;gap:10px}.summary div{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.18);border-radius:16px;padding:12px 14px;min-width:74px;text-align:center}.summary strong{display:block;font-size:22px}.summary span{font-size:11px}.section-block{margin-top:22px}.section-head{display:flex;justify-content:space-between;align-items:center;margin:0 4px 10px}.section-head h2{margin:2px 0 0;font-size:20px}.section-head.danger{color:#9f2a2a}.count{background:#e5eeea;border-radius:999px;padding:6px 10px;font-weight:700}.visit-card,.task-row{background:#fff;border:1px solid #e1e9e5;border-radius:18px;padding:16px;margin-bottom:10px;box-shadow:0 6px 18px rgba(18,53,43,.05)}.visit-card{display:grid;grid-template-columns:90px minmax(0,1fr) auto;gap:14px}.visit-time span{font-size:18px;font-weight:800;display:block}.visit-time small{color:#5e756e}.visit-main h3,.task-main h3{margin:0 0 4px;font-size:17px}.type,.task-main p{margin:0 0 8px;color:#5d706a}.meta{display:flex;align-items:flex-start;gap:6px;color:#4a5d57;font-size:13px;margin-top:5px}.meta mat-icon{font-size:17px;width:17px;height:17px}.visit-actions,.task-actions{display:flex;flex-direction:column;gap:7px;min-width:124px}.task-row{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:12px;align-items:start}.task-status mat-icon{color:#198754}.empty{background:#fff;border:1px dashed #bdccc6;border-radius:16px;padding:18px;color:#657771}.completed{opacity:.85}.error-banner{position:sticky;bottom:80px;background:#8f1f1f;color:#fff;padding:12px 14px;border-radius:12px;margin-top:16px}.loading{display:flex;justify-content:center;padding:80px}.visit-actions button,.task-actions button{white-space:nowrap}@media(max-width:720px){:host{padding:12px 10px 90px}.hero{align-items:start;flex-direction:column}.summary{width:100%}.summary div{flex:1}.visit-card{grid-template-columns:72px 1fr}.visit-actions{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr}.task-row{grid-template-columns:30px 1fr}.task-actions{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr 1fr}.task-actions button{min-width:0;font-size:12px}}
  `],
})
export class TodayComponent {
  busyId: string | null = null;
  errorText = '';

  constructor(public fieldWork: FieldWorkService, private router: Router) {}

  addressForVisit(visit: FieldVisit): string {
    return (visit.homeAddress || visit.patient?.address || '').trim();
  }

  phoneForVisit(visit: FieldVisit): string {
    return (visit.patientTelephone || visit.patient?.phone || '').trim();
  }

  directions(address: string): void {
    if (!address) return;
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank', 'noopener');
  }

  call(phone: string): void {
    if (!phone) return;
    window.location.href = `tel:${phone.replace(/[^+\d]/g, '')}`;
  }

  openPatient(patientId?: string | null): void {
    if (!patientId) return;
    void this.router.navigate(['/PatientList', patientId]);
  }

  async completeVisit(visit: FieldVisit): Promise<void> {
    if (!visit.id || visit.status === 'completed') return;
    this.busyId = visit.id;
    this.errorText = '';
    try { await this.fieldWork.completeVisit(visit.id); }
    catch (error: any) { this.errorText = error?.message || 'Unable to complete visit.'; }
    finally { this.busyId = null; }
  }

  async completeTask(task: FieldTask): Promise<void> {
    if (!task.id || task.status === 'done') return;
    this.busyId = task.id;
    this.errorText = '';
    try { await this.fieldWork.completeTask(task.id); }
    catch (error: any) { this.errorText = error?.message || 'Unable to complete task.'; }
    finally { this.busyId = null; }
  }

  trackVisit = (_: number, item: FieldVisit) => item.id;
  trackTask = (_: number, item: FieldTask) => item.id;
}
