import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { IonButton, IonSpinner } from '@ionic/angular/standalone';
import { CarePlanEdit, CarePlanRow, CarePlanService } from '../services/care-plan.service';
import { carePlanIsLocked } from './care-plan';

@Component({
  selector: 'app-care-plan-followup', standalone: true,
  imports: [CommonModule, IonButton, IonSpinner],
  template: `<section aria-label="Existing care plans">
    <h2>Continue the existing care plan</h2>
    <p>A follow-up does not require a new plan. Review the active plan; modify it only if care changes.</p>
    <ion-spinner *ngIf="loading"></ion-spinner>
    <div role="alert" *ngIf="error">{{ error }} <ion-button fill="clear" (click)="load()">Retry</ion-button></div>
    <ng-container *ngIf="!loading && !error">
      <article *ngFor="let plan of plans">
        <h3>{{ plan.title }}</h3><p>{{ plan.description }}</p>
        <p>Started {{ plan.startDate }} · {{ locked(plan) ? 'Signed / read-only' : 'Existing plan' }}</p>
        <ion-button fill="clear" [disabled]="busy" (click)="viewDetails(plan)">View goals and interventions</ion-button>
        <div *ngIf="details[plan.id] as detail">
          <strong>Goals</strong><ul><li *ngFor="let goal of detail.goals">{{ goal }}</li></ul>
          <strong>Interventions</strong><ul><li *ngFor="let action of detail.interventions">{{ action }}</li></ul>
          <p *ngIf="!detail.goals.length && !detail.interventions.length">No structured goals or interventions recorded.</p>
        </div>
        <ion-button [disabled]="disabled || busy" (click)="continuePlan(plan)">Continue plan — no change</ion-button>
        <ion-button fill="outline" *ngIf="!locked(plan)" [disabled]="disabled || busy" (click)="edit(plan)">Modify existing plan</ion-button>
        <p *ngIf="locked(plan)">Signed content is preserved. Request an authorized clinical amendment if it needs to change.</p>
      </article>
      <p *ngIf="!plans.length">No active plan for this selection.</p>
      <ion-button *ngIf="!plans.length" [disabled]="disabled || busy" (click)="createRequested.emit()">Create a plan if needed</ion-button>
    </ng-container>
    <p role="status" *ngIf="message">{{ message }}</p>
  </section>`,
  styles: [`section{padding:16px;margin:12px 0;background:#f1f7f5;border-radius:16px}h2{font-size:20px}article{background:white;padding:14px;margin:12px 0;border:1px solid #d5e4df;border-radius:12px}p{white-space:pre-wrap;line-height:1.5}[role=alert]{color:#a12929}`],
})
export class CarePlanFollowupComponent implements OnChanges {
  private service = inject(CarePlanService);
  @Input() patientId = ''; @Input() woundId: string | null = null; @Input() episodeId = '';
  @Input() visitId = ''; @Input() appointmentId = ''; @Input() disabled = false;
  @Output() createRequested = new EventEmitter<void>();
  @Output() editRequested = new EventEmitter<CarePlanEdit>();
  plans: CarePlanRow[] = []; loading = true; busy = false; error = ''; message = '';
  details: Record<string, { goals: string[]; interventions: string[] }> = {};
  private loadId = 0;
  locked = carePlanIsLocked;
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['patientId'] || changes['woundId'] || changes['episodeId']) void this.load();
  }
  async load(): Promise<void> {
    const id = ++this.loadId; this.loading = true; this.error = ''; this.message = '';
    try {
      const plans = await this.service.listActive(this.patientId, this.woundId, this.episodeId);
      if (id === this.loadId) this.plans = plans;
    } catch (e: any) { if (id === this.loadId) this.error = e?.message || 'Existing plans could not be loaded. Do not create a duplicate.'; }
    finally { if (id === this.loadId) this.loading = false; }
  }
  async continuePlan(plan: CarePlanRow): Promise<void> {
    if (this.busy || this.disabled) return;
    this.busy = true; this.message = '';
    try {
      await this.service.continuePlan(this.patientId, plan.id, { woundId: this.woundId,
        episodeId: this.episodeId, visitId: this.visitId, appointmentId: this.appointmentId });
      this.message = 'Existing care plan reviewed — no new plan created.';
    } catch (e: any) { this.message = e?.message || 'Review could not be saved.'; }
    finally { this.busy = false; }
  }
  async viewDetails(plan: CarePlanRow): Promise<void> {
    this.busy = true;
    try { this.details[plan.id] = await this.service.details(this.patientId, plan.id); }
    catch (e: any) { this.message = e?.message || 'Plan details could not be loaded.'; }
    finally { this.busy = false; }
  }
  async edit(plan: CarePlanRow): Promise<void> {
    if (this.busy || this.disabled) return;
    this.busy = true; this.message = '';
    try { this.editRequested.emit(await this.service.loadForEdit(this.patientId, plan.id, this.woundId)); }
    catch (e: any) { this.message = e?.message || 'Plan could not be opened for editing.'; }
    finally { this.busy = false; }
  }
}
