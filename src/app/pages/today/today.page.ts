import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { IonBadge, IonButton, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonNote, IonSpinner, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { callOutline, folderOpenOutline, navigateOutline } from 'ionicons/icons';
import { FieldTask, FieldVisit, FieldWorkService } from '../../services/field-work.service';

@Component({
  selector: 'app-today',
  standalone: true,
  imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent, IonButton, IonIcon, IonList, IonItem, IonLabel, IonBadge, IonNote, IonSpinner],
  template: `
    <ion-header><ion-toolbar><ion-title>Today</ion-title></ion-toolbar></ion-header>
    <ion-content class="ion-padding">
      <ng-container *ngIf="work.today$() | async as day; else loading">
        <div class="hero"><p class="eyebrow">FIELD WORK</p><h1>My day</h1><p>{{ day.visits.length }} visit(s) · {{ day.overdueTasks.length + day.dueTodayTasks.length }} open task(s)</p></div>

        <h2>Today's visits</h2>
        <ion-card *ngFor="let visit of day.visits" class="work-card">
          <ion-card-header>
            <ion-card-subtitle>{{ work.toDate(visit.start) | date:'shortTime' }} · {{ visit.visitType || 'Scheduled visit' }}</ion-card-subtitle>
            <ion-card-title>{{ visit.patient?.name || visit.patientName }}</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <p>{{ visit.appointmentDetails || 'Assigned field visit' }}</p>
            <p *ngIf="address(visit)"><strong>Location:</strong> {{ address(visit) }}</p>
            <div class="actions">
              <ion-button size="small" fill="outline" *ngIf="address(visit)" (click)="directions(visit)"><ion-icon slot="start" [icon]="navigateOutline"></ion-icon>Directions</ion-button>
              <ion-button size="small" fill="outline" *ngIf="phone(visit)" [href]="'tel:' + phone(visit)"><ion-icon slot="start" [icon]="callOutline"></ion-icon>Call</ion-button>
              <ion-button size="small" fill="outline" *ngIf="visit.patientId" (click)="chart(visit.patientId)"><ion-icon slot="start" [icon]="folderOpenOutline"></ion-icon>Chart</ion-button>
              <ion-button size="small" color="success" *ngIf="visit.status !== 'completed'" (click)="completeVisit(visit)">Complete</ion-button>
              <ion-badge color="success" *ngIf="visit.status === 'completed'">Completed</ion-badge>
            </div>
          </ion-card-content>
        </ion-card>
        <ion-note *ngIf="!day.visits.length">No assigned visits for today.</ion-note>

        <h2 *ngIf="day.overdueTasks.length">Overdue</h2>
        <ng-container *ngFor="let task of day.overdueTasks"><ng-container *ngTemplateOutlet="taskTpl; context: { $implicit: task, overdue: true }"></ng-container></ng-container>
        <h2>Due today</h2>
        <ng-container *ngFor="let task of day.dueTodayTasks"><ng-container *ngTemplateOutlet="taskTpl; context: { $implicit: task, overdue: false }"></ng-container></ng-container>
        <ion-note *ngIf="!day.dueTodayTasks.length">No tasks due today.</ion-note>

        <h2 *ngIf="day.completedTodayTasks.length">Completed today</h2>
        <ion-item *ngFor="let task of day.completedTodayTasks" lines="full"><ion-label><strong>{{ task.title }}</strong><p>{{ task.patient?.name || 'Patient task' }}</p></ion-label><ion-badge color="success">Done</ion-badge></ion-item>
      </ng-container>
      <ng-template #loading><div class="loading"><ion-spinner></ion-spinner></div></ng-template>

      <ng-template #taskTpl let-task let-overdue="overdue">
        <ion-card class="task-card" [class.overdue]="overdue">
          <ion-card-content>
            <div class="task-head"><div><strong>{{ task.title }}</strong><p>{{ task.patient?.name || 'Patient task' }}</p></div><ion-badge [color]="overdue ? 'danger' : 'primary'">{{ overdue ? 'Overdue' : 'Due' }}</ion-badge></div>
            <p *ngIf="task.patient?.address"><strong>Location:</strong> {{ task.patient?.address }}</p>
            <div class="actions"><ion-button size="small" fill="outline" *ngIf="task.patient?.address" (click)="directionsTask(task)">Directions</ion-button><ion-button size="small" fill="outline" (click)="chart(task.patientId)">Chart</ion-button><ion-button size="small" color="success" (click)="completeTask(task)">Mark done</ion-button></div>
          </ion-card-content>
        </ion-card>
      </ng-template>
    </ion-content>
  `,
  styles: [`
    .hero{background:linear-gradient(135deg,#0f6b46,#173b5b);color:white;border-radius:24px;padding:20px;margin-bottom:24px}.hero h1{margin:2px 0 6px;font-size:30px}.hero p{margin:0;opacity:.9}.eyebrow{font-size:11px;letter-spacing:.12em;font-weight:700}.work-card,.task-card{border-radius:20px;box-shadow:0 8px 24px rgba(15,23,42,.08)}h2{font-size:18px;margin:24px 4px 10px}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.task-head{display:flex;justify-content:space-between;gap:12px}.task-head p{margin:4px 0}.overdue{border-left:4px solid var(--ion-color-danger)}.loading{display:grid;place-items:center;min-height:50vh}
  `]
})
export class TodayPage {
  readonly navigateOutline = navigateOutline;
  readonly callOutline = callOutline;
  readonly folderOpenOutline = folderOpenOutline;

  constructor(public work: FieldWorkService, private router: Router) {}
  address(v: FieldVisit): string { return v.patient?.address || v.homeAddress || ''; }
  phone(v: FieldVisit): string { return v.patient?.phone || v.patientTelephone || ''; }
  directions(v: FieldVisit): void { this.openMap(this.address(v)); }
  directionsTask(t: FieldTask): void { this.openMap(t.patient?.address || ''); }
  chart(patientId?: string): void { if (patientId) this.router.navigate(['/tabs/skin-wound', patientId, 'assessments']); }
  async completeVisit(v: FieldVisit): Promise<void> { await this.work.completeVisit(v.id); }
  async completeTask(t: FieldTask): Promise<void> { await this.work.completeTask(t.id); }
  private openMap(address: string): void { if (!address) return; window.open('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(address), '_blank', 'noopener'); }
}
