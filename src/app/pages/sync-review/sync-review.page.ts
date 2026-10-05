import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  arrowBackOutline,
  checkmarkCircleOutline,
  cloudOfflineOutline,
  refreshOutline,
  trashOutline,
} from 'ionicons/icons';

import {
  DurableClinicalMutationService,
  DurableMutationView,
} from '../../services/durable-clinical-mutation.service';

@Component({
  selector: 'app-sync-review',
  standalone: true,
  imports: [
    CommonModule,
    IonBadge,
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonHeader,
    IonIcon,
    IonTitle,
    IonToolbar,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-button slot="start" fill="clear" (click)="back()">
          <ion-icon name="arrow-back-outline"></ion-icon>
        </ion-button>
        <ion-title>Sync Review</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="page">
        <section class="hero">
          <p class="eyebrow">CLINICAL DELIVERY</p>
          <h1>Sync Review</h1>
          <p>Queued clinical evidence is encrypted on this device. Conflicts are never auto-overwritten.</p>
        </section>

        <div class="summary">
          <div><strong>{{ durable.pendingCount() }}</strong><span>Pending</span></div>
          <div><strong>{{ failedCount }}</strong><span>Failed</span></div>
          <div><strong>{{ durable.conflictCount() }}</strong><span>Needs review</span></div>
        </div>

        <ion-card *ngFor="let item of durable.items()" class="item-card">
          <ion-card-content>
            <div class="row">
              <div>
                <p class="eyebrow dark">{{ item.entityType }}</p>
                <h2>{{ label(item.operation) }}</h2>
              </div>
              <ion-badge [color]="badgeColor(item)">{{ statusLabel(item.status) }}</ion-badge>
            </div>

            <p class="meta" *ngIf="item.entityId">Record {{ item.entityId }}</p>
            <p class="error" *ngIf="item.error">{{ item.error }}</p>

            <div class="warning" *ngIf="item.status === 'needs_review'">
              <ion-icon name="alert-circle-outline"></ion-icon>
              <span>
                The queued write was not applied. Verify the live chart before removing the local copy.
                EVV evidence must never be overwritten just to clear a conflict.
              </span>
            </div>

            <div class="actions">
              <ion-button size="small" fill="outline"
                          *ngIf="item.status === 'waiting_for_network' || item.status === 'failed'"
                          (click)="retry(item)">
                <ion-icon slot="start" name="refresh-outline"></ion-icon>
                Retry
              </ion-button>

              <ion-button size="small" fill="outline"
                          *ngIf="item.patientId"
                          (click)="openChart(item)">
                Open patient chart
              </ion-button>

              <ion-button size="small" color="danger" fill="clear"
                          *ngIf="item.status === 'needs_review'"
                          (click)="discardAfterReview(item)">
                <ion-icon slot="start" name="trash-outline"></ion-icon>
                Server verified — remove local copy
              </ion-button>
            </div>
          </ion-card-content>
        </ion-card>

        <section class="empty" *ngIf="!durable.items().length">
          <ion-icon name="checkmark-circle-outline"></ion-icon>
          <h2>Clinical queue is clear</h2>
          <p>No durable writes are waiting or blocked on this device.</p>
        </section>
      </div>
    </ion-content>
  `,
  styles: [`
    ion-content{--background:#f4f8fb}.page{max-width:720px;margin:0 auto;padding:20px 16px 36px}.hero{padding:8px 4px 14px}.hero h1{margin:0;color:#15324b;font-size:28px}.hero>p:last-child{color:#6c8293;font-size:12px;line-height:1.5}.eyebrow{margin:0 0 4px;color:#4c809e;font-size:9px;font-weight:900;letter-spacing:.15em}.eyebrow.dark{color:#657d8f}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:8px 0 14px}.summary div{padding:12px;border-radius:15px;background:#fff;text-align:center;box-shadow:0 5px 16px rgba(35,67,87,.06)}.summary strong,.summary span{display:block}.summary strong{font-size:22px;color:#15324b}.summary span{font-size:9px;color:#748999;text-transform:uppercase;letter-spacing:.08em}.item-card{margin:10px 0;border-radius:18px;box-shadow:0 6px 20px rgba(35,67,87,.07)}.row{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.row h2{margin:0;color:#15324b;font-size:16px}.meta{font-size:10px;color:#788c9b;word-break:break-all}.error{padding:9px;border-radius:10px;background:#fff4f2;color:#9f3027;font-size:11px;line-height:1.4}.warning{display:flex;gap:8px;margin-top:10px;padding:10px;border-radius:12px;background:#fff8e8;color:#805b15;font-size:11px;line-height:1.45}.warning ion-icon{flex:none;font-size:18px}.actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.empty{text-align:center;padding:46px 20px;color:#718696}.empty ion-icon{font-size:46px;color:#159268}.empty h2{margin:8px 0 4px;color:#15324b}
  `],
})
export class SyncReviewPage {
  constructor(
    public readonly durable: DurableClinicalMutationService,
    private readonly router: Router,
  ) {
    addIcons({
      alertCircleOutline,
      arrowBackOutline,
      checkmarkCircleOutline,
      cloudOfflineOutline,
      refreshOutline,
      trashOutline,
    });
  }

  get failedCount(): number {
    return this.durable.items().filter((item) => item.status === 'failed').length;
  }

  back(): void {
    void this.router.navigate(['/tabs/today']);
  }

  label(operation: string): string {
    const labels: Record<string, string> = {
      visit_check_in: 'Visit check-in',
      visit_check_out: 'Visit checkout',
      visit_journey_step: 'Visit workflow progress',
      appointment_complete: 'Appointment completion',
    };
    return labels[operation] || operation.replace(/_/g, ' ');
  }

  statusLabel(status: DurableMutationView['status']): string {
    return status.replace(/_/g, ' ');
  }

  badgeColor(item: DurableMutationView): string {
    if (item.status === 'needs_review' || item.status === 'failed') return 'danger';
    if (item.status === 'waiting_for_network' || item.status === 'syncing') return 'warning';
    return 'success';
  }

  async retry(item: DurableMutationView): Promise<void> {
    await this.durable.retry(item.id).catch(() => undefined);
  }

  openChart(item: DurableMutationView): void {
    if (!item.patientId) return;
    void this.router.navigate(['/tabs/skin-wound', item.patientId, 'assessments']);
  }

  async discardAfterReview(item: DurableMutationView): Promise<void> {
    const confirmed = window.confirm(
      'Remove this encrypted local mutation only after you verified that the live server chart contains the correct clinical evidence. Continue?'
    );
    if (!confirmed) return;
    await this.durable.discard(item.id);
  }
}
