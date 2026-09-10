import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton, IonBadge, IonButton, IonButtons, IonCard, IonCardContent,
  IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonNote, IonSelect,
  IonSelectOption, IonSpinner, IonTitle, IonToggle, IonToolbar, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { documentTextOutline, shieldCheckmarkOutline } from 'ionicons/icons';
import {
  MobileCareAlgorithm, MobileOrderReceiptMethod, MobileOrderService,
  MobilePrescriber, MobileWoundOption,
} from '../../services/mobile-order.service';
import { ClinicalIdentityService, ClinicalIdentitySnapshot } from '../../services/clinical-identity.service';

@Component({
  selector: 'app-clinical-order',
  standalone: true,
  imports: [CommonModule, FormsModule, IonBackButton, IonBadge, IonButton, IonButtons,
    IonCard, IonCardContent, IonContent, IonHeader, IonIcon, IonItem, IonLabel,
    IonNote, IonSelect, IonSelectOption, IonSpinner, IonTitle, IonToggle, IonToolbar],
  template: `
  <ion-header class="ion-no-border"><ion-toolbar>
    <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/patients"></ion-back-button></ion-buttons>
    <ion-title>Clinical Order</ion-title>
  </ion-toolbar></ion-header>
  <ion-content>
    <div class="page">
      <section class="hero"><p class="eyebrow">ORG-GOVERNED ORDERING</p><h1>Place from a published care algorithm</h1>
        <p>Clinical content comes from algorithms published by your organization admin. Mobile does not invent treatment instructions.</p></section>

      <ion-card *ngIf="loading"><ion-card-content class="center"><ion-spinner></ion-spinner> Loading clinical catalog…</ion-card-content></ion-card>
      <ion-card *ngIf="!loading && error"><ion-card-content class="error">{{ error }}</ion-card-content></ion-card>

      <ng-container *ngIf="!loading && !error">
        <ion-card>
          <ion-card-content>
            <p class="eyebrow dark">1 · TARGET</p>
            <ion-item lines="full">
              <ion-select label="Wound (optional)" labelPlacement="stacked" [(ngModel)]="woundId" (ionChange)="onWoundChanged()" placeholder="Patient-level order">
                <ion-select-option value="">Patient-level / no wound link</ion-select-option>
                <ion-select-option *ngFor="let wound of wounds" [value]="wound.woundId">{{ wound.label }}</ion-select-option>
              </ion-select>
            </ion-item>
          </ion-card-content>
        </ion-card>

        <ion-card>
          <ion-card-content>
            <p class="eyebrow dark">2 · PUBLISHED ALGORITHM</p>
            <ion-item lines="full">
              <ion-select label="Algorithm" labelPlacement="stacked" [(ngModel)]="algorithmId" (ionChange)="onAlgorithmChanged()" placeholder="Select published protocol">
                <ion-select-option *ngFor="let algorithm of algorithms" [value]="algorithm.id">{{ algorithm.name }} · {{ algorithm.woundType }}</ion-select-option>
              </ion-select>
            </ion-item>
            <div class="empty" *ngIf="!algorithms.length">No published care algorithms are available for this organization. An org admin must publish one before it can be used here.</div>
            <div class="preview" *ngIf="selectedAlgorithm">
              <div class="preview-head"><ion-icon [icon]="documentTextOutline"></ion-icon><strong>{{ selectedAlgorithm.name }}</strong><ion-badge>{{ selectedAlgorithm.woundType }}</ion-badge></div>
              <pre>{{ preview }}</pre>
            </div>
          </ion-card-content>
        </ion-card>

        <ion-card>
          <ion-card-content>
            <p class="eyebrow dark">3 · ORDER PROVENANCE</p>
            <div class="identity"><ion-icon [icon]="shieldCheckmarkOutline"></ion-icon><div><strong>{{ identity?.displayName }}</strong><small>{{ identity?.credentials || identity?.role }}</small></div></div>
            <div *ngIf="isPrescriber" class="notice">You are documenting this order directly as the prescriber.</div>
            <ng-container *ngIf="!isPrescriber">
              <ion-item lines="full">
                <ion-select label="How was the order received?" labelPlacement="stacked" [(ngModel)]="receiptMethod">
                  <ion-select-option value="telephone">Telephone</ion-select-option>
                  <ion-select-option value="verbal">Verbal</ion-select-option>
                </ion-select>
              </ion-item>
              <ion-item lines="full">
                <ion-select label="Prescriber" labelPlacement="stacked" [(ngModel)]="prescriberUid" placeholder="Select provider / NP">
                  <ion-select-option *ngFor="let p of prescribers" [value]="p.uid">{{ p.displayName }}{{ p.credentials ? ' · ' + p.credentials : '' }}</ion-select-option>
                </ion-select>
              </ion-item>
              <ion-item lines="none"><ion-toggle [(ngModel)]="readBackConfirmed">Read-back confirmed</ion-toggle></ion-item>
              <ion-note>A telephone/verbal order is recorded with an outstanding co-signature for the selected prescriber.</ion-note>
            </ng-container>
          </ion-card-content>
        </ion-card>

        <ion-button expand="block" size="large" [disabled]="saving || !selectedAlgorithm || (!isPrescriber && (!prescriberUid || !readBackConfirmed))" (click)="save()">
          <ion-spinner *ngIf="saving" name="crescent"></ion-spinner><span *ngIf="!saving">Place order</span>
        </ion-button>
      </ng-container>
    </div>
  </ion-content>`,
  styles: [`
    .page{max-width:820px;margin:0 auto;padding:16px 14px 40px;background:#f4f7f9;min-height:100%}.hero{padding:22px;border-radius:24px;background:linear-gradient(145deg,#0d7657,#173f60);color:#fff;margin-bottom:14px}.hero h1{font-size:25px;margin:5px 0}.hero p{margin:0;opacity:.82;line-height:1.45}.eyebrow{font-size:10px;font-weight:800;letter-spacing:.14em;margin:0}.eyebrow.dark{color:#63788e;margin-bottom:8px}ion-card{border-radius:20px;box-shadow:0 5px 22px rgba(18,46,67,.06);margin:12px 0}.preview{background:#f4f8fa;border-radius:16px;padding:13px;margin-top:14px}.preview-head{display:flex;gap:8px;align-items:center;color:#173f60}.preview-head ion-badge{margin-left:auto}pre{white-space:pre-wrap;font-family:inherit;font-size:12px;line-height:1.5;color:#334155}.identity{display:flex;gap:10px;align-items:center;padding:12px;background:#eef7f3;border-radius:14px}.identity ion-icon{font-size:24px;color:#087455}.identity small{display:block;color:#64748b}.notice,.empty,.error{padding:12px;border-radius:12px;margin-top:10px}.notice{background:#eef7f3;color:#245d49}.empty{background:#f8fafc;color:#64748b}.error{background:#fff1f0;color:#9d2b25}.center{display:flex;gap:10px;align-items:center}
  `],
})
export class ClinicalOrderPage implements OnInit {
  private route = inject(ActivatedRoute); private router = inject(Router);
  private orderService = inject(MobileOrderService); private identityService = inject(ClinicalIdentityService);
  private toast = inject(ToastController);
  patientId = this.route.snapshot.paramMap.get('patientId') || '';
  loading = true; saving = false; error = '';
  algorithms: MobileCareAlgorithm[] = []; prescribers: MobilePrescriber[] = []; wounds: MobileWoundOption[] = [];
  identity: ClinicalIdentitySnapshot | null = null; algorithmId = ''; woundId = ''; selectedAlgorithm: MobileCareAlgorithm | null = null; woundLabel = '';
  receiptMethod: MobileOrderReceiptMethod = 'telephone'; prescriberUid = ''; readBackConfirmed = false;
  readonly documentTextOutline = documentTextOutline; readonly shieldCheckmarkOutline = shieldCheckmarkOutline;

  constructor(){ addIcons({ documentTextOutline, shieldCheckmarkOutline }); }
  get isPrescriber(){ return ['provider','np'].includes(String(this.identity?.role || '').toLowerCase()); }
  get preview(){ return this.selectedAlgorithm ? this.orderService.renderAlgorithm(this.selectedAlgorithm) : ''; }

  async ngOnInit(){
    try {
      this.identity = await this.identityService.requireCurrentIdentity();
      [this.algorithms, this.prescribers, this.wounds] = await Promise.all([
        this.orderService.listPublishedAlgorithms(), this.orderService.listPrescribers(), this.orderService.listWounds(this.patientId)
      ]);
    } catch(e:any){ this.error = e?.message || 'Clinical ordering workspace could not be loaded.'; }
    finally { this.loading = false; }
  }
  onAlgorithmChanged(){ this.selectedAlgorithm = this.algorithms.find(a => a.id === this.algorithmId) || null; }
  onWoundChanged(){ this.woundLabel = this.wounds.find(w => w.woundId === this.woundId)?.label || ''; }
  async save(){
    if(!this.selectedAlgorithm || this.saving) return; this.saving = true;
    try {
      await this.orderService.createAlgorithmOrder(this.patientId, { algorithm: this.selectedAlgorithm, woundId: this.woundId || null, woundLabel: this.woundLabel || null, receiptMethod: this.isPrescriber ? 'direct' : this.receiptMethod, prescriberUid: this.prescriberUid || null, readBackConfirmed: this.readBackConfirmed });
      const t = await this.toast.create({ message:'Order saved to patient chart', duration:2200, color:'success' }); await t.present();
      await this.router.navigate(['/tabs','skin-wound',this.patientId,'assessments']);
    } catch(e:any){ const t = await this.toast.create({message:e?.message || 'Order could not be saved', duration:3200, color:'danger'}); await t.present(); }
    finally { this.saving = false; }
  }
}
