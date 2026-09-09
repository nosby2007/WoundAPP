import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { IonBadge, IonButton, IonCard, IonCardContent, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonNote, IonSpinner, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { arrowForwardOutline, checkmarkCircleOutline, locationOutline, navigateOutline, timeOutline } from 'ionicons/icons';
import { Observable } from 'rxjs';
import { FieldTask, FieldVisit, FieldWorkService, TodayWork } from '../../services/field-work.service';

@Component({
  selector: 'app-today',
  standalone: true,
  imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardContent, IonButton, IonIcon, IonItem, IonLabel, IonBadge, IonNote, IonSpinner],
  template: `
    <ion-header class="ion-no-border"><ion-toolbar><ion-title>Today</ion-title></ion-toolbar></ion-header>
    <ion-content>
      <div class="page">
        <ng-container *ngIf="day$ | async as day; else loading">
          <section class="hero">
            <div class="hero-head"><div><p class="eyebrow">FIELD COMMAND</p><h1>{{ greeting }}</h1><p>{{ todayLabel }}</p></div><div class="live"><span></span>Live</div></div>
            <div class="metrics">
              <div><strong>{{ day.visits.length }}</strong><span>Visits</span></div>
              <div><strong>{{ day.overdueTasks.length + day.dueTodayTasks.length }}</strong><span>Open tasks</span></div>
              <div><strong>{{ day.completedTodayTasks.length }}</strong><span>Done</span></div>
            </div>
          </section>

          <section class="section">
            <div class="section-head"><div><p class="eyebrow dark">ROUTE</p><h2>Today's visits</h2></div><ion-badge color="primary">{{ day.visits.length }}</ion-badge></div>
            <ion-card *ngFor="let visit of day.visits" class="visit-card" button="true" (click)="openVisit(visit)">
              <ion-card-content>
                <div class="visit-row">
                  <div class="time-tile"><ion-icon [icon]="timeOutline"></ion-icon><strong>{{ work.toDate(visit.start) | date:'shortTime' }}</strong></div>
                  <div class="visit-main"><span class="micro">{{ visit.visitType || 'Scheduled visit' }}</span><h3>{{ visit.patient?.name || visit.patientName }}</h3><p *ngIf="address(visit)"><ion-icon [icon]="locationOutline"></ion-icon>{{ address(visit) }}</p><p *ngIf="visit.appointmentDetails" class="instruction">{{ visit.appointmentDetails }}</p></div>
                  <ion-icon class="arrow" [icon]="arrowForwardOutline"></ion-icon>
                </div>
                <div class="visit-foot"><ion-badge [color]="visit.status === 'completed' ? 'success' : 'primary'">{{ visit.status === 'completed' ? 'Completed' : 'Open visit' }}</ion-badge><span>{{ visit.assignedToName || 'Assigned to you' }}</span></div>
              </ion-card-content>
            </ion-card>
            <div class="empty" *ngIf="!day.visits.length"><ion-icon [icon]="checkmarkCircleOutline"></ion-icon><strong>No assigned visits today</strong><p>Your schedule is clear.</p></div>
          </section>

          <section class="section" *ngIf="day.overdueTasks.length || day.dueTodayTasks.length">
            <div class="section-head"><div><p class="eyebrow dark">WORK QUEUE</p><h2>Tasks</h2></div><ion-badge [color]="day.overdueTasks.length ? 'danger' : 'primary'">{{ day.overdueTasks.length + day.dueTodayTasks.length }}</ion-badge></div>
            <div class="task-strip overdue" *ngFor="let task of day.overdueTasks" (click)="openTask(task)"><div><span class="micro danger">OVERDUE</span><strong>{{ task.title }}</strong><p>{{ task.patient?.name || 'Patient task' }}</p></div><ion-icon [icon]="arrowForwardOutline"></ion-icon></div>
            <div class="task-strip" *ngFor="let task of day.dueTodayTasks" (click)="openTask(task)"><div><span class="micro">DUE TODAY</span><strong>{{ task.title }}</strong><p>{{ task.patient?.name || 'Patient task' }}</p></div><ion-icon [icon]="arrowForwardOutline"></ion-icon></div>
          </section>

          <section class="section" *ngIf="day.completedTodayTasks.length">
            <div class="section-head"><div><p class="eyebrow dark">CLOSED LOOP</p><h2>Completed today</h2></div></div>
            <ion-item lines="none" class="completed" *ngFor="let task of day.completedTodayTasks" (click)="openTask(task)" button="true"><ion-icon slot="start" color="success" [icon]="checkmarkCircleOutline"></ion-icon><ion-label><strong>{{ task.title }}</strong><p>{{ task.patient?.name || 'Patient task' }}</p></ion-label></ion-item>
          </section>
        </ng-container>
        <ng-template #loading><div class="loading"><ion-spinner></ion-spinner><p>Preparing your field day…</p></div></ng-template>
      </div>
    </ion-content>
  `,
  styles: [`
    :host{--ink:#10233f;--muted:#687b8f;--green:#0b7551;--navy:#173d5d}ion-toolbar{--background:#fff;--color:var(--ink)}.page{background:#f4f7fa;min-height:100%;padding:16px 16px 34px}.hero{background:linear-gradient(145deg,#0b7451 0%,#143a59 82%);color:#fff;border-radius:28px;padding:22px;box-shadow:0 18px 42px rgba(18,58,78,.2)}.hero-head{display:flex;justify-content:space-between;gap:16px}.hero h1{font-size:29px;margin:3px 0 4px}.hero p{margin:0;opacity:.8}.eyebrow{font-size:10px;letter-spacing:.16em;font-weight:800;margin:0 0 5px}.eyebrow.dark{color:#557087}.live{height:28px;padding:0 10px;border-radius:999px;background:rgba(255,255,255,.1);display:flex;align-items:center;gap:6px;font-size:11px}.live span{width:7px;height:7px;border-radius:50%;background:#80e1b5;box-shadow:0 0 0 5px rgba(128,225,181,.12)}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:22px}.metrics div{background:rgba(255,255,255,.09);border-radius:16px;padding:12px}.metrics strong{display:block;font-size:23px}.metrics span{font-size:10px;text-transform:uppercase;letter-spacing:.08em;opacity:.72}.section{margin-top:26px}.section-head{display:flex;align-items:flex-end;justify-content:space-between;margin:0 4px 10px}.section-head h2{margin:0;color:var(--ink);font-size:20px}.visit-card{margin:10px 0;border-radius:22px;box-shadow:0 7px 24px rgba(30,55,75,.07)}.visit-card ion-card-content{padding:16px}.visit-row{display:grid;grid-template-columns:64px 1fr 22px;gap:12px;align-items:start}.time-tile{background:#eef7f3;border-radius:17px;min-height:64px;display:grid;place-items:center;align-content:center;color:var(--green);gap:3px}.time-tile ion-icon{font-size:18px}.time-tile strong{font-size:12px}.visit-main h3{margin:3px 0 4px;color:var(--ink);font-size:18px}.visit-main p{margin:4px 0;color:var(--muted);font-size:12px;display:flex;gap:5px;align-items:flex-start}.visit-main p ion-icon{font-size:15px;flex:none}.instruction{display:-webkit-box!important;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.micro{font-size:9px;letter-spacing:.12em;font-weight:800;color:#517086}.micro.danger{color:#b44343}.arrow{color:#9aabb9;margin-top:22px}.visit-foot{display:flex;align-items:center;justify-content:space-between;border-top:1px solid #edf1f4;margin-top:13px;padding-top:11px;font-size:10px;color:var(--muted)}.task-strip{background:#fff;border-radius:18px;padding:14px 15px;margin:9px 0;display:flex;justify-content:space-between;align-items:center;box-shadow:0 5px 18px rgba(30,55,75,.05)}.task-strip.overdue{border-left:4px solid #d45858}.task-strip strong{display:block;color:var(--ink);margin:3px 0}.task-strip p{margin:0;color:var(--muted);font-size:12px}.task-strip>ion-icon{color:#9aabb9}.completed{--background:#fff;border-radius:16px;margin:8px 0}.empty{background:#fff;border-radius:22px;padding:28px;text-align:center;color:var(--muted)}.empty ion-icon{font-size:34px;color:var(--green)}.empty strong{display:block;color:var(--ink);margin-top:8px}.empty p{margin:4px 0}.loading{min-height:65vh;display:grid;place-items:center;align-content:center;color:var(--muted)}
  `],
})
export class TodayPage {
  readonly arrowForwardOutline = arrowForwardOutline;
  readonly checkmarkCircleOutline = checkmarkCircleOutline;
  readonly locationOutline = locationOutline;
  readonly navigateOutline = navigateOutline;
  readonly timeOutline = timeOutline;
  readonly day$: Observable<TodayWork>;
  readonly todayLabel = new Intl.DateTimeFormat(undefined, { weekday:'long', month:'short', day:'numeric' }).format(new Date());
  readonly greeting = this.greetingForNow();

  constructor(public work: FieldWorkService, private router: Router) { this.day$ = work.today$(); }
  address(v: FieldVisit): string { return v.patient?.address || v.homeAddress || ''; }
  openVisit(v: FieldVisit): void { void this.router.navigate(['/tabs/today/visit', v.id]); }
  openTask(t: FieldTask): void { void this.router.navigate(['/tabs/today/task', t.id]); }
  private greetingForNow(): string { const hour = new Date().getHours(); return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'; }
}
