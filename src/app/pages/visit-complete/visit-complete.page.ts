import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonSpinner,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  arrowBackOutline,
  calendarOutline,
  checkmarkCircleOutline,
  cloudDoneOutline,
  cloudOfflineOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons';

import {
  VisitCompletenessService,
  WorkflowCompletionResult,
} from '../../services/visit-completeness.service';
import { DurableClinicalMutationService } from '../../services/durable-clinical-mutation.service';

@Component({
  selector: 'app-visit-complete',
  standalone: true,
  imports: [CommonModule, IonButton, IonCard, IonCardContent, IonContent, IonIcon, IonSpinner],
  template: `
    <ion-content [fullscreen]="true">
      <div class="complete-page">
        <section class="hero">
          <div class="success-orb">
            <ion-icon name="checkmark-circle-outline"></ion-icon>
          </div>
          <p class="eyebrow">VISIT CLOSED</p>
          <h1>Visit complete</h1>
          <p>
            Point-of-care checkout is captured. Review the delivery state below
            before leaving the patient location.
          </p>
        </section>

        <ion-card class="sync-card">
          <ion-card-content>
            <div class="card-head">
              <div>
                <p class="eyebrow dark">SYNC SAFETY</p>
                <h2>{{ syncHeading }}</h2>
              </div>
              <ion-icon
                [name]="conflicts ? 'alert-circle-outline' : pending ? 'cloud-offline-outline' : 'cloud-done-outline'"
                [class.warn]="pending"
                [class.danger]="conflicts">
              </ion-icon>
            </div>

            <p *ngIf="conflicts" class="danger-copy">
              {{ conflicts }} clinical mutation{{ conflicts === 1 ? '' : 's' }} need review.
              Do not assume the server accepted the queued evidence.
            </p>
            <p *ngIf="!conflicts && pending" class="warn-copy">
              {{ pending }} encrypted clinical mutation{{ pending === 1 ? '' : 's' }} remain queued.
              Keep WoundAPP available until delivery completes.
            </p>
            <p *ngIf="!conflicts && !pending">
              Clinical delivery queue is clear.
            </p>
          </ion-card-content>
        </ion-card>

        <ion-card class="checklist-card">
          <ion-card-content>
            <div class="card-head">
              <div><p class="eyebrow dark">DOCUMENTATION</p><h2>Visit completeness</h2></div>
              <ion-icon name="shield-checkmark-outline"></ion-icon>
            </div>

            <div *ngIf="loading" class="loading"><ion-spinner></ion-spinner></div>

            <ng-container *ngIf="!loading && completeness as result">
              <div class="score">
                <strong>{{ result.completed }}/{{ result.totalRequired }}</strong>
                <span>required items documented today</span>
              </div>

              <div class="row" *ngFor="let item of result.items" [class.optional]="!item.required">
                <span class="status-dot" [class.done]="item.complete"></span>
                <div>
                  <strong>{{ label(item.circle) }}</strong>
                  <p>{{ item.required ? 'Required' : 'When indicated' }} · {{ item.count }} recorded</p>
                </div>
              </div>

              <div class="missing" *ngIf="result.missingRequired.length">
                <ion-icon name="alert-circle-outline"></ion-icon>
                <span>
                  Missing required documentation:
                  {{ missingLabels(result).join(', ') }}.
                </span>
              </div>
            </ng-container>
          </ion-card-content>
        </ion-card>

        <div class="actions">
          <ion-button expand="block" color="warning" *ngIf="pending || conflicts" (click)="openSyncReview()">
            <ion-icon slot="start" name="cloud-offline-outline"></ion-icon>
            Open Sync Review
          </ion-button>
          <ion-button expand="block" fill="outline" (click)="backToVisit()">
            <ion-icon slot="start" name="calendar-outline"></ion-icon>
            Schedule follow-up / review visit
          </ion-button>
          <ion-button expand="block" (click)="goToday()">
            <ion-icon slot="start" name="arrow-back-outline"></ion-icon>
            Return to Today
          </ion-button>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    :host{--ink:#15324b;--muted:#6d8191;--green:#0b7551}
    ion-content{--background:#f3f7fa}.complete-page{padding:max(28px,env(safe-area-inset-top)) 16px 32px;max-width:680px;margin:0 auto}
    .hero{text-align:center;padding:20px 16px 14px}.success-orb{width:72px;height:72px;margin:0 auto 14px;display:grid;place-items:center;border-radius:25px;background:linear-gradient(145deg,#0d7b58,#235c7b);color:#fff;box-shadow:0 16px 35px rgba(22,84,106,.18)}.success-orb ion-icon{font-size:39px}.eyebrow{margin:0 0 5px;font-size:9px;letter-spacing:.16em;font-weight:900;color:#4c809e}.eyebrow.dark{color:#567186}.hero h1{margin:0;color:var(--ink);font-size:31px;letter-spacing:-.03em}.hero>p:last-child{max-width:480px;margin:8px auto 0;color:var(--muted);font-size:12px;line-height:1.5}
    ion-card{margin:12px 0;border-radius:22px;box-shadow:0 8px 26px rgba(29,61,80,.07)}ion-card-content{padding:17px}.card-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.card-head h2{margin:0;color:var(--ink);font-size:19px}.card-head>ion-icon{font-size:27px;color:var(--green)}.card-head>ion-icon.warn{color:#b7791f}.card-head>ion-icon.danger{color:#b42318}.sync-card p:not(.eyebrow){margin:10px 0 0;color:var(--muted);font-size:12px;line-height:1.45}.warn-copy{color:#8a5a14!important}.danger-copy{color:#a12a23!important}
    .score{display:flex;align-items:baseline;gap:8px;margin:16px 0 9px;padding:12px;border-radius:15px;background:#eff8f4}.score strong{font-size:24px;color:var(--green)}.score span{font-size:11px;color:#5e786d}.row{display:grid;grid-template-columns:10px 1fr;gap:10px;padding:10px 2px;border-top:1px solid #edf1f3}.row.optional{opacity:.72}.status-dot{width:9px;height:9px;margin-top:4px;border-radius:50%;background:#d8e0e5}.status-dot.done{background:#25a071}.row strong{color:var(--ink);font-size:12px}.row p{margin:2px 0 0;color:var(--muted);font-size:10px}.missing{display:flex;gap:8px;margin-top:12px;padding:10px;border-radius:13px;background:#fff4f2;color:#9f3027;font-size:11px;line-height:1.4}.missing ion-icon{flex:none;font-size:17px}.loading{padding:28px;text-align:center}.actions{display:grid;gap:9px;margin-top:18px}.actions ion-button{height:50px;--border-radius:16px}
  `],
})
export class VisitCompletePage implements OnInit {
  patientId = '';
  appointmentId = '';
  visitType = 'routine';
  loading = true;
  completeness: WorkflowCompletionResult | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly visitCompleteness: VisitCompletenessService,
    public readonly durable: DurableClinicalMutationService,
  ) {
    addIcons({
      alertCircleOutline,
      arrowBackOutline,
      calendarOutline,
      checkmarkCircleOutline,
      cloudDoneOutline,
      cloudOfflineOutline,
      shieldCheckmarkOutline,
    });
  }

  async ngOnInit(): Promise<void> {
    this.appointmentId = this.route.snapshot.paramMap.get('appointmentId') || '';
    this.patientId = this.route.snapshot.queryParamMap.get('patientId') || '';
    this.visitType = this.route.snapshot.queryParamMap.get('visitType') || 'routine';

    if (this.patientId) {
      try {
        this.completeness = await this.visitCompleteness.evaluate(this.patientId, this.visitType);
      } finally {
        this.loading = false;
      }
    } else {
      this.loading = false;
    }
  }

  get pending(): number {
    return this.durable.pendingCount();
  }

  get conflicts(): number {
    return this.durable.conflictCount();
  }

  get syncHeading(): string {
    if (this.conflicts) return 'Review required';
    if (this.pending) return 'Encrypted queue pending';
    return 'Delivery complete';
  }

  label(circle: string): string {
    const labels: Record<string, string> = {
      visit: 'Visit / EVV',
      assessment: 'Clinical assessment',
      braden: 'Braden score',
      systemic: 'Head-to-toe / systemic assessment',
      carePlan: 'Care plan',
      order: 'Orders',
      education: 'Education',
      woundAssessment: 'Wound assessment',
      progressNote: 'Progress note',
    };
    return labels[circle] || circle;
  }

  missingLabels(result: WorkflowCompletionResult): string[] {
    return result.missingRequired.map((circle) => this.label(circle));
  }

  openSyncReview(): void {
    void this.router.navigate(['/tabs/sync-review']);
  }

  backToVisit(): void {
    if (!this.appointmentId) return;
    void this.router.navigate(['/tabs/today/visit', this.appointmentId]);
  }

  goToday(): void {
    void this.router.navigate(['/tabs/today']);
  }
}
