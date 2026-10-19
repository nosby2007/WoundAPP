import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonCheckbox,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  checkmarkCircleOutline,
  documentTextOutline,
  lockClosedOutline,
  shieldCheckmarkOutline,
  warningOutline,
} from 'ionicons/icons';

import {
  ClinicalSignatureService,
  FieldSignableDocument,
  FieldSignableKind,
} from '../../services/clinical-signature.service';
import { ClinicalVisitLink } from '../../shared/clinical-visit-link';

@Component({
  selector: 'app-field-signature-center',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonBackButton,
    IonBadge,
    IonButton,
    IonButtons,
    IonCheckbox,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSpinner,
    IonTitle,
    IonToolbar,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button [defaultHref]="'/tabs/skin-wound/' + patientId + '/assessments'"></ion-back-button>
        </ion-buttons>
        <ion-title>Review & Sign</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="page">
        <section class="hero">
          <div class="hero-icon"><ion-icon name="shield-checkmark-outline"></ion-icon></div>
          <div>
            <p class="eyebrow">FIELD DOCUMENT FINALIZATION</p>
            <h1>Finish the clinical record before leaving the field.</h1>
            <p>Only sign documentation you personally authored, or an order that specifically requires your prescriber co-signature.</p>
          </div>
        </section>

        <section class="notice">
          <ion-icon name="warning-outline"></ion-icon>
          <div>
            <strong>A signature finalizes the record.</strong>
            <p>Signed documents are intended to become immutable. Corrections should be handled through an addendum/amendment workflow, not by rewriting the signed record.</p>
          </div>
        </section>

        <ion-item class="attestation" lines="none">
          <ion-checkbox slot="start" [(ngModel)]="attestationAccepted"></ion-checkbox>
          <ion-label class="ion-text-wrap">
            <strong>Electronic signature attestation</strong>
            <p>I reviewed each document before signing and attest that the documentation accurately reflects my work or order for this encounter.</p>
          </ion-label>
        </ion-item>

        <div class="loading" *ngIf="loading"><ion-spinner></ion-spinner> Loading visit documents…</div>
        <div class="error" *ngIf="errorMsg">{{ errorMsg }}</div>

        <section class="summary" *ngIf="!loading && documents.length">
          <div><strong>{{ signedCount }}</strong><span>signed</span></div>
          <div><strong>{{ unsignedMineCount }}</strong><span>ready for me</span></div>
          <div><strong>{{ waitingCount }}</strong><span>waiting on another signer</span></div>
        </section>

        <ion-list lines="none" class="documents" *ngIf="!loading">
          <ion-item *ngFor="let doc of documents" class="doc-row">
            <div slot="start" class="kind-icon">
              <ion-icon [name]="doc.signed ? 'checkmark-circle-outline' : 'document-text-outline'"></ion-icon>
            </div>

            <ion-label class="ion-text-wrap">
              <div class="row-title">
                <strong>{{ doc.title }}</strong>
                <ion-badge [color]="doc.signed ? 'success' : doc.canSign ? 'warning' : 'medium'">
                  {{ doc.signed ? 'Signed' : doc.canSign ? 'Ready to sign' : 'Pending signer' }}
                </ion-badge>
              </div>
              <p>{{ kindLabel(doc.kind) }} · {{ doc.subtitle }}</p>
              <ion-note *ngIf="!doc.signed && !doc.canSign">{{ doc.signerRequirement }}</ion-note>
              <ion-note *ngIf="doc.signed"><ion-icon name="lock-closed-outline"></ion-icon> Finalized clinical record</ion-note>
            </ion-label>

            <ion-button
              slot="end"
              size="small"
              [fill]="doc.canSign && !doc.signed ? 'solid' : 'outline'"
              [disabled]="doc.signed || !doc.canSign || !attestationAccepted || signingId === doc.id"
              (click)="sign(doc)">
              <ion-spinner *ngIf="signingId === doc.id" name="crescent"></ion-spinner>
              <span *ngIf="signingId !== doc.id">{{ doc.signed ? 'Signed' : 'Sign' }}</span>
            </ion-button>
          </ion-item>
        </ion-list>

        <section class="empty" *ngIf="!loading && !documents.length">
          <ion-icon name="document-text-outline"></ion-icon>
          <h2>No signable visit documents found</h2>
          <p>Create or link assessment, care plan, order, education or progress-note documentation to this encounter first.</p>
        </section>

        <ion-button expand="block" fill="outline" [disabled]="loading" (click)="load()">
          Refresh signature status
        </ion-button>
      </div>
    </ion-content>
  `,
  styles: [`
    :host{--ink:#10233f;--muted:#64788b;--green:#0b7551}.page{max-width:900px;margin:0 auto;padding:16px 14px 40px;background:#f4f7f9;min-height:100%}.hero{display:flex;gap:16px;padding:20px;border-radius:24px;background:linear-gradient(145deg,#15465b,#0b7551);color:#fff}.hero-icon{width:48px;height:48px;border-radius:16px;background:rgba(255,255,255,.14);display:grid;place-items:center;flex:0 0 48px}.hero-icon ion-icon{font-size:25px}.eyebrow{font-size:10px;letter-spacing:.15em;font-weight:900;margin:0}.hero h1{font-size:25px;line-height:1.08;margin:5px 0 7px}.hero p{margin:0;opacity:.82;font-size:12px}.notice{display:flex;gap:11px;padding:14px;margin-top:14px;border-radius:16px;background:#fff7e8;border:1px solid #f1ddaf;color:#704d0d}.notice ion-icon{font-size:22px;flex:0 0 22px}.notice p{margin:3px 0 0;font-size:11px;line-height:1.5}.attestation{margin:14px 0;border-radius:17px;--background:#fff;box-shadow:0 5px 18px rgba(22,55,74,.06)}.attestation p{font-size:11px;color:var(--muted);white-space:normal}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin:14px 0}.summary div{background:#fff;border-radius:15px;padding:12px;border:1px solid #e4ecef}.summary strong,.summary span{display:block}.summary strong{font-size:21px;color:var(--ink)}.summary span{font-size:10px;color:var(--muted);margin-top:2px}.documents{background:transparent}.doc-row{--background:#fff;border-radius:17px;margin:9px 0;--padding-start:12px;--inner-padding-end:10px;box-shadow:0 5px 18px rgba(22,55,74,.05)}.kind-icon{width:38px;height:38px;border-radius:13px;display:grid;place-items:center;background:#eaf5f0;color:var(--green)}.kind-icon ion-icon{font-size:21px}.row-title{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.doc-row p{font-size:11px;color:var(--muted);margin:4px 0}.doc-row ion-note{font-size:10px;white-space:normal}.loading,.empty,.error{padding:22px;text-align:center}.loading{color:var(--muted)}.error{background:#fff1f2;color:#9f1239;border-radius:14px}.empty{background:#fff;border-radius:18px;color:var(--muted)}.empty ion-icon{font-size:31px;color:var(--green)}.empty h2{color:var(--ink);font-size:17px}@media(max-width:620px){.summary{grid-template-columns:1fr 1fr 1fr}.doc-row{align-items:flex-start}.doc-row ion-button{margin-top:10px}.hero{align-items:flex-start}}
  `],
})
export class FieldSignatureCenterPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly signatures = inject(ClinicalSignatureService);
  private readonly toast = inject(ToastController);

  patientId = this.route.snapshot.paramMap.get('patientId') || '';
  appointmentId = this.route.snapshot.queryParamMap.get('appointmentId') || '';
  woundVisitId =
    this.route.snapshot.queryParamMap.get('fieldEncounterVisitId') ||
    this.route.snapshot.queryParamMap.get('woundVisitId') ||
    this.appointmentId ||
    '';
  woundId = this.route.snapshot.queryParamMap.get('woundId') || '';
  episodeId = this.route.snapshot.queryParamMap.get('episodeId') || '';

  documents: FieldSignableDocument[] = [];
  loading = true;
  errorMsg = '';
  signingId = '';
  attestationAccepted = false;

  constructor() {
    addIcons({
      checkmarkCircleOutline,
      documentTextOutline,
      lockClosedOutline,
      shieldCheckmarkOutline,
      warningOutline,
    });
  }

  ngOnInit(): void {
    void this.load();
  }

  get visitLink(): ClinicalVisitLink {
    return {
      visitId: this.woundVisitId || null,
      fieldEncounterVisitId: this.woundVisitId || null,
      appointmentId: this.appointmentId || null,
      woundId: this.woundId || null,
      episodeId: this.episodeId || null,
    };
  }

  get signedCount(): number {
    return this.documents.filter((item) => item.signed).length;
  }

  get unsignedMineCount(): number {
    return this.documents.filter((item) => !item.signed && item.canSign).length;
  }

  get waitingCount(): number {
    return this.documents.filter((item) => !item.signed && !item.canSign).length;
  }

  async load(): Promise<void> {
    if (!this.patientId) return;
    this.loading = true;
    this.errorMsg = '';
    try {
      this.documents = await this.signatures.listVisitDocuments(this.patientId, this.visitLink);
    } catch (error: any) {
      this.errorMsg = error?.message || 'Unable to load visit signature status.';
    } finally {
      this.loading = false;
    }
  }

  async sign(document: FieldSignableDocument): Promise<void> {
    if (!this.attestationAccepted || this.signingId) return;
    this.signingId = document.id;
    this.errorMsg = '';
    try {
      await this.signatures.sign(this.patientId, document);
      await this.load();
      const toast = await this.toast.create({
        message: `${this.kindLabel(document.kind)} signed and finalized.`,
        duration: 2200,
        color: 'success',
      });
      await toast.present();
    } catch (error: any) {
      this.errorMsg = error?.message || 'Document could not be signed.';
    } finally {
      this.signingId = '';
    }
  }

  kindLabel(kind: FieldSignableKind): string {
    return ({
      assessment: 'Wound assessment',
      care_plan: 'Care plan',
      progress_note: 'Progress note',
      education: 'Education',
      order: 'Clinical order',
    } as Record<FieldSignableKind, string>)[kind];
  }
}
