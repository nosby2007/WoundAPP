// src/app/shared/bedside-safety-banner.component.ts
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonBadge,
  IonIcon,
  IonButton,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  warningOutline,
  alertCircleOutline,
  shieldCheckmarkOutline,
  checkmarkCircleOutline,
  informationCircleOutline,
  chevronDownOutline,
  chevronUpOutline,
} from 'ionicons/icons';
import { ClinicalSafetySnapshot } from './clinical-safety-rules';

@Component({
  selector: 'app-bedside-safety-banner',
  standalone: true,
  imports: [
    CommonModule,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonBadge,
    IonIcon,
    IonButton,
  ],
  template: `
    <div class="safety-banner-wrapper" *ngIf="snapshot">
      <ion-card
        [class]="'safety-card ' + snapshot.compositeRiskLevel"
        [class.urgent]="snapshot.compositeRiskLevel === 'immediate_escalation'"
      >
        <ion-card-header class="banner-header">
          <div class="title-row">
            <div class="header-left">
              <ion-icon
                [name]="
                  snapshot.compositeRiskLevel === 'immediate_escalation'
                    ? 'alert-circle-outline'
                    : snapshot.compositeRiskLevel === 'urgent_attention'
                    ? 'warning-outline'
                    : 'shield-checkmark-outline'
                "
                [class]="'header-icon ' + snapshot.compositeRiskLevel"
              ></ion-icon>
              <div>
                <ion-card-title class="banner-title">
                  {{
                    snapshot.compositeRiskLevel === 'immediate_escalation'
                      ? 'CRITICAL CLINICAL SAFETY ALERT'
                      : snapshot.compositeRiskLevel === 'urgent_attention'
                      ? 'Clinical Action Required'
                      : snapshot.compositeRiskLevel === 'caution'
                      ? 'Safety Monitoring Active'
                      : 'Clinical Safety Screen: Stable'
                  }}
                </ion-card-title>
                <p class="banner-subtitle">
                  NERDS: {{ snapshot.nerds.score }}/5 · STONEES: {{ snapshot.stonees.score }}/7 · ABPI: {{ snapshot.abpi.abpiValue !== null ? snapshot.abpi.abpiValue.toFixed(2) : 'Unrecorded' }}
                </p>
              </div>
            </div>
            <ion-button fill="clear" size="small" (click)="toggleDetails()">
              <ion-icon [name]="showDetails ? 'chevron-up-outline' : 'chevron-down-outline'"></ion-icon>
            </ion-button>
          </div>
        </ion-card-header>

        <ion-card-content>
          <div class="alert-badges" *ngIf="snapshot.activeAlerts.length">
            <div
              *ngFor="let alert of snapshot.activeAlerts"
              class="alert-pill"
              [class.critical-pill]="alert.includes('CRITICAL')"
            >
              <ion-icon name="warning-outline"></ion-icon>
              <span>{{ alert }}</span>
            </div>
          </div>

          <div *ngIf="!showDetails && snapshot.compositeRiskLevel !== 'stable'" class="quick-summary">
            <span *ngIf="snapshot.stonees.isDeepTissueInfectionSuspected" class="tag urgent-tag">Deep Infection Risk</span>
            <span *ngIf="snapshot.nerds.isSuperficialInfectionSuspected" class="tag warn-tag">Superficial Colonization</span>
            <span *ngIf="snapshot.abpi.severity === 'critical'" class="tag critical-tag">Compression Contraindicated</span>
            <span *ngIf="snapshot.abpi.severity === 'warning'" class="tag warn-tag">Perfusion Warning</span>
          </div>

          <div class="expanded-grid" *ngIf="showDetails">
            <div class="safety-section">
              <div class="section-heading">
                <h4>NERDS (Superficial / Local Infection)</h4>
                <ion-badge [color]="snapshot.nerds.isSuperficialInfectionSuspected ? 'danger' : 'medium'">
                  {{ snapshot.nerds.score }}/5
                </ion-badge>
              </div>
              <p class="summary-text">{{ snapshot.nerds.clinicalSummary }}</p>
              <div class="criteria-list">
                <div
                  *ngFor="let c of snapshot.nerds.criteria"
                  class="criterion-row"
                  [class.met]="c.met"
                >
                  <span class="letter-badge">{{ c.letter }}</span>
                  <div class="criterion-body">
                    <strong>{{ c.name }}</strong>: {{ c.description }}
                    <span class="evidence" *ngIf="c.clinicalEvidence"> — {{ c.clinicalEvidence }}</span>
                  </div>
                  <ion-icon [name]="c.met ? 'checkmark-circle-outline' : 'shield-checkmark-outline'"></ion-icon>
                </div>
              </div>
              <div class="guidance-box" *ngIf="snapshot.nerds.prescriptiveGuidance.length">
                <ul>
                  <li *ngFor="let g of snapshot.nerds.prescriptiveGuidance">{{ g }}</li>
                </ul>
              </div>
            </div>

            <div class="safety-section">
              <div class="section-heading">
                <h4>STONEES (Deep / Spreading Infection)</h4>
                <ion-badge [color]="snapshot.stonees.isDeepTissueInfectionSuspected ? 'danger' : 'medium'">
                  {{ snapshot.stonees.score }}/7
                </ion-badge>
              </div>
              <p class="summary-text">{{ snapshot.stonees.clinicalSummary }}</p>
              <div class="criteria-list">
                <div
                  *ngFor="let c of snapshot.stonees.criteria"
                  class="criterion-row"
                  [class.met]="c.met"
                  [class.critical-row]="c.isCriticalStandalone && c.met"
                >
                  <span class="letter-badge" [class.critical-letter]="c.isCriticalStandalone">{{ c.letter }}</span>
                  <div class="criterion-body">
                    <strong>{{ c.name }}</strong>: {{ c.description }}
                    <span class="evidence" *ngIf="c.clinicalEvidence"> — {{ c.clinicalEvidence }}</span>
                  </div>
                  <ion-icon [name]="c.met ? 'alert-circle-outline' : 'shield-checkmark-outline'"></ion-icon>
                </div>
              </div>
              <div class="mandatory-actions-box" *ngIf="snapshot.stonees.mandatoryActions.length">
                <h5>Mandatory Clinical Escalation</h5>
                <ul>
                  <li *ngFor="let a of snapshot.stonees.mandatoryActions">{{ a }}</li>
                </ul>
              </div>
            </div>

            <div class="safety-section">
              <div class="section-heading">
                <h4>ABPI (Arterial Perfusion & Compression Rules)</h4>
                <ion-badge [color]="snapshot.abpi.severity === 'critical' ? 'danger' : snapshot.abpi.severity === 'warning' ? 'warning' : 'success'">
                  {{ snapshot.abpi.categoryLabel }}
                </ion-badge>
              </div>
              <p class="summary-text">{{ snapshot.abpi.summary }}</p>
              <div class="compression-status-callout" [class.danger-callout]="snapshot.abpi.severity === 'critical'">
                <strong>Compression Rule: </strong> {{ snapshot.abpi.compressionStatusLabel }}
              </div>
              <div class="contraindications-box" *ngIf="snapshot.abpi.contraindications.length">
                <h6>Contraindications:</h6>
                <ul>
                  <li *ngFor="let ci of snapshot.abpi.contraindications">{{ ci }}</li>
                </ul>
              </div>
              <div class="actions-box" *ngIf="snapshot.abpi.recommendedActions.length">
                <h6>Recommended Actions:</h6>
                <ul>
                  <li *ngFor="let ra of snapshot.abpi.recommendedActions">{{ ra }}</li>
                </ul>
              </div>
            </div>
          </div>
        </ion-card-content>
      </ion-card>
    </div>
  `,
  styles: [
    `
      .safety-banner-wrapper {
        margin: 12px 0;
      }
      .safety-card {
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        border-left: 6px solid #10b981;
      }
      .safety-card.immediate_escalation {
        border-left-color: #ef4444;
        background: #fff8f8;
      }
      .safety-card.urgent_attention {
        border-left-color: #f59e0b;
        background: #fffbf0;
      }
      .safety-card.caution {
        border-left-color: #3b82f6;
      }
      .banner-header {
        padding: 12px 16px 8px 16px;
      }
      .title-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .header-left {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .header-icon {
        font-size: 28px;
      }
      .header-icon.immediate_escalation {
        color: #ef4444;
      }
      .header-icon.urgent_attention {
        color: #f59e0b;
      }
      .banner-title {
        font-size: 15px;
        font-weight: 700;
        margin: 0;
      }
      .banner-subtitle {
        font-size: 12px;
        color: #6b7280;
        margin: 2px 0 0 0;
      }
      .alert-badges {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 8px;
      }
      .alert-pill {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        background: #fef3c7;
        color: #92400e;
        padding: 6px 10px;
        border-radius: 6px;
        font-weight: 500;
      }
      .alert-pill.critical-pill {
        background: #fee2e2;
        color: #b91c1c;
        font-weight: 600;
      }
      .quick-summary {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        margin-top: 4px;
      }
      .tag {
        font-size: 11px;
        padding: 3px 8px;
        border-radius: 4px;
        font-weight: 600;
      }
      .tag.urgent-tag,
      .tag.critical-tag {
        background: #fee2e2;
        color: #dc2626;
      }
      .tag.warn-tag {
        background: #fef3c7;
        color: #d97706;
      }
      .expanded-grid {
        display: flex;
        flex-direction: column;
        gap: 16px;
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid #e5e7eb;
      }
      .safety-section {
        background: #ffffff;
        padding: 12px;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
      }
      .section-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 6px;
      }
      .section-heading h4 {
        margin: 0;
        font-size: 14px;
        font-weight: 700;
      }
      .summary-text {
        font-size: 12px;
        color: #4b5563;
        margin: 0 0 8px 0;
      }
      .criteria-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .criterion-row {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        padding: 4px 6px;
        border-radius: 4px;
        background: #f9fafb;
      }
      .criterion-row.met {
        background: #fef2f2;
        color: #991b1b;
        font-weight: 500;
      }
      .criterion-row.critical-row {
        background: #fee2e2;
        border: 1px solid #ef4444;
      }
      .letter-badge {
        font-weight: 800;
        background: #e5e7eb;
        color: #374151;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 11px;
      }
      .letter-badge.critical-letter {
        background: #dc2626;
        color: white;
      }
      .criterion-body {
        flex: 1;
      }
      .evidence {
        color: #b91c1c;
        font-style: italic;
      }
      .guidance-box,
      .mandatory-actions-box,
      .contraindications-box,
      .actions-box {
        margin-top: 8px;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 11px;
      }
      .guidance-box {
        background: #eff6ff;
        color: #1e40af;
      }
      .mandatory-actions-box {
        background: #fee2e2;
        color: #991b1b;
      }
      .mandatory-actions-box h5 {
        margin: 0 0 4px 0;
        font-size: 12px;
        font-weight: 700;
      }
      .compression-status-callout {
        padding: 8px;
        border-radius: 6px;
        background: #ecfdf5;
        color: #065f46;
        font-size: 12px;
        margin: 6px 0;
      }
      .compression-status-callout.danger-callout {
        background: #fee2e2;
        color: #b91c1c;
        font-weight: 700;
      }
      .contraindications-box {
        background: #fff1f2;
        color: #9f1239;
      }
      .contraindications-box h6,
      .actions-box h6 {
        margin: 0 0 2px 0;
        font-size: 11px;
        font-weight: 700;
      }
      .actions-box {
        background: #f0fdf4;
        color: #166534;
      }
      ul {
        margin: 0;
        padding-left: 16px;
      }
      li {
        margin: 2px 0;
      }
    `,
  ],
})
export class BedsideSafetyBannerComponent {
  @Input() snapshot: ClinicalSafetySnapshot | null = null;
  showDetails = false;

  constructor() {
    addIcons({
      warningOutline,
      alertCircleOutline,
      shieldCheckmarkOutline,
      checkmarkCircleOutline,
      informationCircleOutline,
      chevronDownOutline,
      chevronUpOutline,
    });
  }

  toggleDetails() {
    this.showDetails = !this.showDetails;
  }
}
