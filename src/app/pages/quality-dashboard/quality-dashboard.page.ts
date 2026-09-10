import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBadge, IonButton, IonContent, IonHeader, IonIcon, IonItem, IonLabel,
  IonList, IonNote, IonSpinner, IonTitle, IonToolbar
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { alertCircleOutline, checkmarkCircleOutline, refreshOutline, warningOutline } from 'ionicons/icons';
import { SmartClinicalNotification, SmartNotificationService } from '../../services/smart-notification.service';

@Component({
  selector: 'app-quality-dashboard',
  standalone: true,
  imports: [
    CommonModule, IonBadge, IonButton, IonContent, IonHeader, IonIcon, IonItem,
    IonLabel, IonList, IonNote, IonSpinner, IonTitle, IonToolbar
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>Quality & Alerts</ion-title>
        <ion-button slot="end" fill="clear" [disabled]="loading" (click)="load()">
          <ion-icon slot="icon-only" name="refresh-outline"></ion-icon>
        </ion-button>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="page">
        <section class="summary">
          <div><span>HIGH</span><strong>{{ count('high') }}</strong></div>
          <div><span>REVIEW</span><strong>{{ count('warning') }}</strong></div>
          <div><span>INFO</span><strong>{{ count('info') }}</strong></div>
        </section>

        <div class="state" *ngIf="loading"><ion-spinner name="crescent"></ion-spinner><p>Reviewing active charts…</p></div>
        <div class="state error" *ngIf="!loading && errorMsg"><ion-icon name="alert-circle-outline"></ion-icon><p>{{ errorMsg }}</p></div>
        <div class="state good" *ngIf="!loading && !errorMsg && !alerts.length">
          <ion-icon name="checkmark-circle-outline"></ion-icon>
          <p>No current quality or documentation alerts in the reviewed charts.</p>
        </div>

        <ion-list lines="none" *ngIf="!loading && alerts.length">
          <ion-item button detail="false" *ngFor="let alert of alerts" (click)="open(alert)" [class.high]="alert.severity === 'high'">
            <div class="severity" slot="start"><ion-icon [name]="alert.severity === 'high' ? 'alert-circle-outline' : 'warning-outline'"></ion-icon></div>
            <ion-label class="ion-text-wrap">
              <div class="row"><strong>{{ alert.title }}</strong><ion-badge [color]="alert.severity === 'high' ? 'danger' : 'warning'">{{ alert.severity }}</ion-badge></div>
              <p class="patient">{{ alert.patientName }}<span *ngIf="alert.mrn"> · MRN {{ alert.mrn }}</span></p>
              <p>{{ alert.message }}</p>
            </ion-label>
          </ion-item>
        </ion-list>

        <ion-note class="footnote">
          Quality alerts are review prompts only. They do not change the chart, stage a wound, or select treatment.
        </ion-note>
      </div>
    </ion-content>
  `,
  styles: [`
    .page{padding:16px;background:#f4f7fa;min-height:100%}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px}.summary div{background:#fff;border:1px solid #e3e9ee;border-radius:18px;padding:14px;text-align:center}.summary span{display:block;font-size:10px;letter-spacing:.12em;color:#6b7d8d;font-weight:800}.summary strong{display:block;font-size:26px;color:#18344c;margin-top:4px}.state{display:grid;place-items:center;gap:8px;padding:40px 16px;color:#667b8e;text-align:center}.state ion-icon{font-size:34px}.good ion-icon{color:#18835e}.error ion-icon{color:#b84242}ion-list{background:transparent}ion-item{--background:#fff;margin-bottom:10px;border-radius:16px;--padding-start:12px;--inner-padding-end:12px;box-shadow:0 5px 18px rgba(30,55,75,.05)}ion-item.high{border-left:4px solid #b84242}.severity{width:36px;height:36px;border-radius:12px;background:#fff4e8;display:grid;place-items:center;color:#a65b19}.high .severity{background:#fff0f0;color:#b84242}.row{display:flex;align-items:center;justify-content:space-between;gap:8px}.patient{font-weight:650;color:#173d5c!important}.footnote{display:block;margin:18px 4px 0;font-size:10px;line-height:1.45}
  `]
})
export class QualityDashboardPage implements OnInit {
  private notifications = inject(SmartNotificationService);
  private router = inject(Router);

  loading = true;
  errorMsg = '';
  alerts: SmartClinicalNotification[] = [];

  constructor() {
    addIcons({ alertCircleOutline, checkmarkCircleOutline, refreshOutline, warningOutline });
  }

  ngOnInit(): void { void this.load(); }

  async load(): Promise<void> {
    this.loading = true;
    this.errorMsg = '';
    try {
      this.alerts = await this.notifications.build(25);
    } catch (error: any) {
      this.errorMsg = error?.message || 'Unable to build the quality dashboard.';
      this.alerts = [];
    } finally {
      this.loading = false;
    }
  }

  count(severity: SmartClinicalNotification['severity']): number {
    return this.alerts.filter((item) => item.severity === severity).length;
  }

  open(alert: SmartClinicalNotification): void {
    void this.router.navigate(alert.actionRoute);
  }
}
