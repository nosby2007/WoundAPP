import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonItem,
  IonLabel, IonNote, IonSelect, IonSelectOption, IonSpinner, IonTitle, IonToolbar
} from '@ionic/angular/standalone';
import { ClinicalDeliveryService } from '../../services/clinical-delivery.service';
import { DeliveryRecipient, ManagedRecipientService } from '../../services/managed-recipient.service';

@Component({
  selector: 'app-clinical-delivery',
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonBackButton, IonButton, IonButtons, IonContent,
    IonHeader, IonItem, IonLabel, IonNote, IonSelect, IonSelectOption,
    IonSpinner, IonTitle, IonToolbar
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button [defaultHref]="backHref"></ion-back-button></ion-buttons>
        <ion-title>Secure Send</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="page">
        <section class="intro">
          <span>CONTROLLED DELIVERY</span>
          <h1>{{ title || 'Clinical document' }}</h1>
          <p>Select an organization-managed recipient. The original finalized document remains immutable.</p>
        </section>

        <div class="state" *ngIf="loading"><ion-spinner name="crescent"></ion-spinner><p>Loading approved recipients…</p></div>
        <div class="error" *ngIf="errorMsg">{{ errorMsg }}</div>

        <ng-container *ngIf="!loading">
          <ion-item class="picker" lines="none">
            <ion-select label="Approved recipient" labelPlacement="stacked" [(ngModel)]="selectedId" placeholder="Select provider, facility, or case manager">
              <ion-select-option *ngFor="let recipient of recipients" [value]="recipient.id">
                {{ recipient.name }} · {{ recipient.organization || recipient.recipientType }}
              </ion-select-option>
            </ion-select>
          </ion-item>

          <section class="recipient-card" *ngIf="selected as recipient">
            <div><span>Recipient</span><strong>{{ recipient.name }}</strong></div>
            <div><span>Organization</span><strong>{{ recipient.organization || '—' }}</strong></div>
            <div><span>Method</span><strong>{{ recipient.preferredMethod === 'secure_fax' ? 'Secure fax' : 'Secure email' }}</strong></div>
            <div><span>Destination</span><strong>{{ recipientsService.maskedDestination(recipient) }}</strong></div>
          </section>

          <ion-note *ngIf="!recipients.length" class="empty">
            No managed recipients are configured. An organization administrator must add approved delivery destinations in JADE-SHOP.
          </ion-note>

          <ion-button expand="block" [disabled]="!selected || sending" (click)="send()">
            <ion-spinner *ngIf="sending" slot="start" name="crescent"></ion-spinner>
            Queue secure delivery
          </ion-button>

          <div class="success" *ngIf="successMsg">{{ successMsg }}</div>
          <ion-note class="footnote">
            WoundApp never marks its own message delivered. A trusted backend transport must confirm the delivery result.
          </ion-note>
        </ng-container>
      </div>
    </ion-content>
  `,
  styles: [`
    .page{padding:18px;background:#f4f7fa;min-height:100%}.intro{background:linear-gradient(145deg,#173d5c,#0b7251);color:#fff;border-radius:24px;padding:20px;margin-bottom:16px}.intro span{font-size:9px;font-weight:800;letter-spacing:.14em;opacity:.72}.intro h1{margin:4px 0 6px;font-size:22px}.intro p{margin:0;font-size:11px;opacity:.8}.picker,.recipient-card{background:#fff;border:1px solid #e0e7ec;border-radius:18px;margin-bottom:14px}.recipient-card{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:15px}.recipient-card span{display:block;font-size:9px;color:#718090;text-transform:uppercase;letter-spacing:.08em}.recipient-card strong{display:block;margin-top:2px;color:#17344c;font-size:12px}.state{display:grid;place-items:center;padding:38px}.error,.success{padding:11px 12px;border-radius:12px;margin:10px 0;font-size:12px}.error{background:#fff0f0;color:#9b3434}.success{background:#e8f6ef;color:#146445}.empty,.footnote{display:block;margin:14px 3px;font-size:10px;line-height:1.45}
  `]
})
export class ClinicalDeliveryPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private delivery = inject(ClinicalDeliveryService);
  readonly recipientsService = inject(ManagedRecipientService);

  patientId = this.route.snapshot.paramMap.get('patientId') || '';
  snapshotId = this.route.snapshot.paramMap.get('snapshotId') || '';
  title = this.route.snapshot.queryParamMap.get('title') || 'Clinical document';
  recipients: DeliveryRecipient[] = [];
  selectedId = '';
  loading = true;
  sending = false;
  errorMsg = '';
  successMsg = '';

  get selected(): DeliveryRecipient | null {
    return this.recipients.find((r) => r.id === this.selectedId) || null;
  }

  get backHref(): string {
    return `/tabs/skin-wound/${this.patientId}/assessments`;
  }

  async ngOnInit(): Promise<void> {
    try {
      this.recipients = await this.recipientsService.list();
    } catch (error: any) {
      this.errorMsg = error?.message || 'Unable to load approved recipients.';
    } finally {
      this.loading = false;
    }
  }

  async send(): Promise<void> {
    const recipient = this.selected;
    if (!recipient || this.sending || !this.snapshotId) return;
    this.sending = true;
    this.errorMsg = '';
    this.successMsg = '';
    try {
      await this.delivery.queue({
        patientId: this.patientId,
        snapshotId: this.snapshotId,
        method: recipient.preferredMethod,
        recipientType: recipient.recipientType,
        destinationLabel: recipient.name,
        destinationToken: recipient.destinationToken,
      });
      this.successMsg = 'Secure delivery queued. Delivery confirmation will be recorded by the transport service.';
    } catch (error: any) {
      this.errorMsg = error?.message || 'Unable to queue this delivery.';
    } finally {
      this.sending = false;
    }
  }
}
