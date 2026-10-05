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
  IonNote,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import {
  arrowBackOutline,
  checkmarkCircleOutline,
  folderOpenOutline,
  navigateOutline,
  timeOutline,
} from 'ionicons/icons';
import { FieldTask, FieldWorkService } from '../../services/field-work.service';

@Component({
  selector: 'app-field-task',
  standalone: true,
  imports: [CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonIcon, IonCard, IonCardContent, IonBadge, IonNote, IonSpinner, IonTextarea],
  template: `
    <ion-header class="ion-no-border"><ion-toolbar><ion-button slot="start" fill="clear" (click)="back()"><ion-icon [icon]="arrowBackOutline"></ion-icon></ion-button><ion-title>Task workspace</ion-title></ion-toolbar></ion-header>
    <ion-content>
      <div class="page" *ngIf="task; else stateTpl">
        <section class="hero">
          <div class="top"><div><p class="eyebrow">FIELD TASK</p><h1>{{ task.title }}</h1><p>{{ task.patient?.name || 'Patient task' }}</p></div><ion-badge [color]="task.status === 'done' ? 'success' : overdue ? 'danger' : 'primary'">{{ task.status === 'done' ? 'Done' : overdue ? 'Overdue' : 'Open' }}</ion-badge></div>
          <div class="hero-meta"><span>Due</span><strong>{{ task.dueAt ? (work.toDate(task.dueAt) | date:'medium') : 'No due time' }}</strong></div>
        </section>

        <section class="quick-actions">
          <button class="quick" *ngIf="address" (click)="directions()"><ion-icon [icon]="navigateOutline"></ion-icon><span>Directions</span></button>
          <button class="quick" *ngIf="task.patientId" (click)="chart()"><ion-icon [icon]="folderOpenOutline"></ion-icon><span>Chart</span></button>
        </section>

        <ion-card>
          <ion-card-content>
            <p class="eyebrow dark">ASSIGNMENT</p>
            <h2>{{ task.title }}</h2>
            <p class="body">{{ task.description || 'No additional task instructions were entered.' }}</p>
            <div class="row" *ngIf="address"><span>Patient location</span><strong>{{ address }}</strong></div>
            <div class="row"><span>Assigned to</span><strong>{{ task.assignedToName || 'You' }}</strong></div>
          </ion-card-content>
        </ion-card>

        <ion-card *ngIf="task.status !== 'done'">
          <ion-card-content>
            <p class="eyebrow dark">COMPLETION</p>
            <h2>Close the loop</h2>
            <p class="body">Add a concise work note when it improves continuity. The note is saved with the completion event.</p>
            <ion-textarea fill="outline" label="Work note (optional)" labelPlacement="stacked" autoGrow="true" [(ngModel)]="workNote" placeholder="What was completed, communicated, or handed off?"></ion-textarea>
            <div class="banner" *ngIf="message" [class.error]="isError">{{ message }}</div>
            <ion-button expand="block" color="success" class="done" [disabled]="busy" (click)="complete()"><ion-spinner *ngIf="busy" name="crescent"></ion-spinner><span *ngIf="!busy">Mark task complete</span></ion-button>
          </ion-card-content>
        </ion-card>

        <ion-card class="complete" *ngIf="task.status === 'done'">
          <ion-card-content><div class="complete-inner"><ion-icon [icon]="checkmarkCircleOutline"></ion-icon><div><strong>Task completed</strong><p *ngIf="task.workNote">{{ task.workNote }}</p><p *ngIf="!task.workNote">Completion was recorded.</p></div></div></ion-card-content>
        </ion-card>
      </div>

      <ng-template #stateTpl><div class="state" *ngIf="loading"><ion-spinner></ion-spinner><p>Preparing secure task workspace…</p></div><div class="state" *ngIf="!loading"><h2>Task unavailable</h2><p>This task is not assigned to this account, no longer exists, or could not be loaded.</p><ion-button (click)="back()">Back to Today</ion-button></div></ng-template>
    </ion-content>
  `,
  styles: [`
    :host{--ink:#10233f;--muted:#64748b;--green:#0b7551}ion-toolbar{--background:#fff;--color:var(--ink)}.page{padding:16px 16px 34px;background:#f5f8fb;min-height:100%}.hero{background:linear-gradient(145deg,#173d5d,#0b7353);color:#fff;border-radius:28px;padding:22px;box-shadow:0 20px 45px rgba(15,50,70,.18)}.top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.hero h1{font-size:26px;line-height:1.14;margin:4px 0 6px}.hero p{margin:0;opacity:.82}.eyebrow{font-size:10px;letter-spacing:.16em;font-weight:800;margin:0 0 6px}.eyebrow.dark{color:#567086}.hero-meta{margin-top:18px;background:rgba(255,255,255,.09);border-radius:15px;padding:11px}.hero-meta span,.row span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.08em;opacity:.7;margin-bottom:4px}.hero-meta strong{font-size:13px}.quick-actions{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:12px 0}.quick{border:0;background:#fff;border-radius:17px;min-height:66px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;color:var(--ink);box-shadow:0 5px 18px rgba(30,55,75,.06)}.quick ion-icon{font-size:22px;color:var(--green)}ion-card{margin:12px 0;border-radius:24px;box-shadow:0 8px 28px rgba(30,55,75,.07)}ion-card-content{padding:20px}h2{margin:0;color:var(--ink);font-size:20px}.body{color:#4c6074;line-height:1.55}.row{padding:13px 0;border-top:1px solid #e6edf3}.row strong{color:var(--ink)}ion-textarea{margin-top:16px}.done{height:48px;margin-top:16px}.banner{margin-top:12px;background:#eaf7f1;color:#0b6849;border-radius:14px;padding:11px 13px}.banner.error{background:#fff0f0;color:#a33333}.complete{background:#edf9f3}.complete-inner{display:flex;gap:12px}.complete-inner ion-icon{font-size:32px;color:var(--green)}.complete-inner strong{color:var(--ink)}.complete-inner p{margin:4px 0;color:var(--muted)}.state{min-height:70vh;display:grid;place-items:center;align-content:center;text-align:center;padding:28px;color:var(--muted)}.state h2{color:var(--ink)}
  `],
})
export class FieldTaskPage implements OnInit {
  readonly arrowBackOutline = arrowBackOutline;
  readonly checkmarkCircleOutline = checkmarkCircleOutline;
  readonly folderOpenOutline = folderOpenOutline;
  readonly navigateOutline = navigateOutline;
  readonly timeOutline = timeOutline;

  task: FieldTask | null = null;
  loading = true;
  busy = false;
  workNote = '';
  message = '';
  isError = false;

  constructor(private route: ActivatedRoute, private router: Router, public work: FieldWorkService) {}

  get address(): string { return this.task?.patient?.address || ''; }
  get overdue(): boolean {
    const due = this.work.toDate(this.task?.dueAt);
    return !!due && this.task?.status !== 'done' && due.getTime() < Date.now();
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('taskId') || '';
    try {
      this.task = await this.work.getTask(id);
      this.workNote = this.task?.workNote || '';
    } finally { this.loading = false; }
  }

  back(): void { void this.router.navigate(['/tabs/today']); }
  chart(): void { if (this.task?.patientId) void this.router.navigate(['/tabs/skin-wound', this.task.patientId, 'assessments']); }
  directions(): void { if (this.address) window.open('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(this.address), '_blank', 'noopener'); }

  async complete(): Promise<void> {
    if (!this.task || this.busy) return;
    this.busy = true; this.message = ''; this.isError = false;
    try {
      await this.work.completeTask(this.task.id, this.workNote);
      this.task = { ...this.task, status: 'done', workNote: this.workNote.trim() || this.task.workNote };
      this.message = 'Task completed.';
    } catch (error: any) {
      this.isError = true;
      this.message = error?.message || 'Unable to complete task.';
    } finally { this.busy = false; }
  }
}
