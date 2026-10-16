import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import {
  IonBackButton, IonBadge, IonButton, IonButtons, IonContent, IonHeader, IonIcon,
  IonItem, IonLabel, IonList, IonSelect, IonSelectOption, IonSpinner, IonTextarea,
  IonTitle, IonToolbar,
} from '@ionic/angular/standalone';
import { documentAttachOutline } from 'ionicons/icons';

import { ClinicalDataService } from '../../services/clinical-data.service';
import { ClinicalPatientDocument } from '../../services/clinical-data-provider';

@Component({
  selector: 'app-patient-documents',
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle,
    IonContent, IonItem, IonSelect, IonSelectOption, IonTextarea, IonButton, IonSpinner,
    IonList, IonLabel, IonIcon, IonBadge,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button [defaultHref]="'/tabs/skin-wound/' + patientId + '/assessments'"></ion-back-button></ion-buttons>
        <ion-title>Patient Documents</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="page">
        <section class="hero">
          <p class="eyebrow">CLINICAL DOCUMENTS</p>
          <h1>{{ patientName || 'Patient' }}</h1>
          <p>View and add documents needed for wound-care continuity without opening the administrative intake workspace.</p>
        </section>

        <div class="state" *ngIf="loading"><ion-spinner></ion-spinner>Loading documents…</div>
        <div class="error" *ngIf="error">{{ error }}</div>

        <section class="card" *ngIf="!loading">
          <div class="head">
            <div><p class="eyebrow dark">DOCUMENTS</p><h2>Patient chart documents</h2></div>
            <ion-badge color="primary">{{ documents.length }}</ion-badge>
          </div>

          <ion-list lines="none" *ngIf="documents.length">
            <ion-item *ngFor="let doc of documents" button detail="false" (click)="openPreview(doc)">
              <ion-icon slot="start" [icon]="documentAttachOutline"></ion-icon>
              <ion-label>
                <strong>{{ doc.name }}</strong>
                <p>{{ doc.type || 'other' }} · {{ doc.description || 'No description' }}</p>
              </ion-label>
              <ion-badge slot="end" color="light">View</ion-badge>
            </ion-item>
          </ion-list>
          <p class="empty" *ngIf="!documents.length">No uploaded patient documents are available.</p>
        </section>

        <section class="card">
          <div class="head"><div><p class="eyebrow dark">ADD TO CHART</p><h2>Upload document</h2></div></div>
          <p class="hint">For RN/NP clinical use: referral, face sheet, authorization, insurance, lab result, discharge summary, consent, or other supporting document.</p>
          <ion-item>
            <ion-select label="Document type" labelPlacement="stacked" [(ngModel)]="docType">
              <ion-select-option value="referral">Referral</ion-select-option>
              <ion-select-option value="facesheet">Face sheet</ion-select-option>
              <ion-select-option value="authorization">Authorization</ion-select-option>
              <ion-select-option value="insurance">Insurance card</ion-select-option>
              <ion-select-option value="dischargeSummary">Discharge summary</ion-select-option>
              <ion-select-option value="consent">Consent</ion-select-option>
              <ion-select-option value="labResult">Lab result</ion-select-option>
              <ion-select-option value="other">Other</ion-select-option>
            </ion-select>
          </ion-item>
          <ion-item><ion-textarea label="Description" labelPlacement="stacked" [(ngModel)]="docDescription"></ion-textarea></ion-item>

          <label class="file-button">
            <ion-icon [icon]="documentAttachOutline"></ion-icon>
            <span>{{ selectedFiles.length ? selectedFiles.length + ' file(s) selected' : 'Choose documents / photos' }}</span>
            <input type="file" multiple accept=".pdf,image/jpeg,image/png,image/tiff" (change)="onFiles($event)">
          </label>

          <ion-button expand="block" [disabled]="uploading || !selectedFiles.length" (click)="upload()">
            <ion-spinner *ngIf="uploading" name="crescent"></ion-spinner>
            <span *ngIf="!uploading">Add to patient chart</span>
          </ion-button>
          <div class="success" *ngIf="message">{{ message }}</div>
        </section>

        <div class="preview-backdrop" *ngIf="previewDocument" (click)="closePreview()">
          <section class="preview-shell" (click)="$event.stopPropagation()">
            <header class="preview-head">
              <strong>{{ previewDocument.name }}</strong>
              <ion-button fill="clear" color="dark" size="small" (click)="closePreview()">Close</ion-button>
            </header>
            <div class="preview-body">
              <img *ngIf="previewKind === 'image' && previewDocument.url" [src]="previewDocument.url" [alt]="previewDocument.name" class="preview-image" />
              <iframe *ngIf="previewKind === 'pdf' && previewUrl" [src]="previewUrl" [title]="previewDocument.name" class="preview-pdf"></iframe>
              <div class="preview-unsupported" *ngIf="previewKind === 'unsupported'">This file type cannot be previewed in the app yet.</div>
            </div>
          </section>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    .page{min-height:100%;padding:16px 16px 36px;background:#f4f7fa}.hero{padding:20px;border-radius:24px;background:linear-gradient(145deg,#173d5c,#0b7251);color:#fff}.hero h1{margin:4px 0}.hero p{margin:0;opacity:.82;font-size:12px}.eyebrow{font-size:10px;letter-spacing:.14em;font-weight:800}.eyebrow.dark{color:#587188}.card{margin-top:15px;padding:16px;border-radius:20px;background:#fff;box-shadow:0 7px 22px rgba(30,55,75,.06)}.head{display:flex;justify-content:space-between;align-items:start}.head h2{margin:2px 0 10px;color:#10233f}.card ion-item{--background:#f7fafc;border-radius:13px;margin:7px 0}.hint,.empty{font-size:11px;color:#667b8e}.file-button{display:flex;align-items:center;gap:9px;padding:14px;border:1px dashed #8da6b8;border-radius:14px;margin:10px 0;color:#173d5c;font-size:12px;font-weight:700}.file-button input{display:none}.success{background:#ecfdf5;color:#166534;border-radius:11px;padding:10px;margin-top:8px}.error{background:#fff1f2;color:#9f1239;border-radius:11px;padding:10px}.state{text-align:center;padding:25px;color:#667b8e}.preview-backdrop{position:fixed;inset:0;z-index:9999;background:rgba(7,22,36,.78);display:grid;place-items:center;padding:12px}.preview-shell{width:min(980px,100%);height:min(88vh,900px);background:#fff;border-radius:22px;overflow:hidden;display:grid;grid-template-rows:auto 1fr;box-shadow:0 28px 70px rgba(0,0,0,.35)}.preview-head{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid #e6ece9}.preview-body{min-height:0;overflow:auto;display:grid;place-items:center;background:#eef3f1}.preview-image{max-width:100%;max-height:100%;object-fit:contain}.preview-pdf{width:100%;height:100%;border:0;background:#fff}.preview-unsupported{padding:24px;color:#64748b;text-align:center}@media(max-width:620px){.preview-backdrop{padding:0}.preview-shell{width:100vw;height:100vh;border-radius:0}}
  `],
})
export class PatientDocumentsPage {
  readonly documentAttachOutline = documentAttachOutline;
  patientId = '';
  patientName = '';
  loading = true;
  uploading = false;
  error = '';
  message = '';
  documents: ClinicalPatientDocument[] = [];
  selectedFiles: File[] = [];
  docType = 'other';
  docDescription = '';
  previewDocument: ClinicalPatientDocument | null = null;
  previewUrl: SafeResourceUrl | null = null;
  previewKind: 'image' | 'pdf' | 'unsupported' = 'unsupported';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly clinicalData: ClinicalDataService,
    private readonly sanitizer: DomSanitizer,
  ) {}

  ionViewWillEnter(): void {
    this.patientId = this.route.snapshot.paramMap.get('patientId') || '';
    void this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      const [patient, documents] = await Promise.all([
        this.clinicalData.getPatient(this.patientId),
        this.clinicalData.listPatientDocuments(this.patientId),
      ]);
      this.patientName = patient?.name || 'Patient';
      this.documents = documents;
    } catch (error: any) {
      this.error = error?.message || 'Unable to load patient documents.';
    } finally {
      this.loading = false;
    }
  }

  onFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFiles = Array.from(input.files || []);
  }

  async upload(): Promise<void> {
    if (!this.selectedFiles.length) return;
    this.uploading = true;
    this.error = '';
    this.message = '';
    try {
      await this.clinicalData.uploadPatientDocuments(this.patientId, this.selectedFiles, { type: this.docType, description: this.docDescription });
      this.selectedFiles = [];
      this.docDescription = '';
      this.documents = await this.clinicalData.listPatientDocuments(this.patientId);
      this.message = 'Document added to the patient chart.';
    } catch (error: any) {
      this.error = error?.message || 'Unable to upload document.';
    } finally {
      this.uploading = false;
    }
  }

  openPreview(doc: ClinicalPatientDocument): void {
    const mime = (doc.mimeType || '').toLowerCase();
    const name = (doc.name || '').toLowerCase();
    if (mime === 'application/pdf' || /\.pdf$/i.test(name)) {
      if (this.isAppleMobilePdfHost()) {
        sessionStorage.setItem('woundapp.document.returnUrl', window.location.href);
        window.location.assign(doc.url);
        return;
      }
      this.previewDocument = doc;
      this.previewKind = 'pdf';
      this.previewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(doc.url);
      return;
    }
    this.previewDocument = doc;
    if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|tiff?)$/i.test(name)) {
      this.previewKind = 'image';
      this.previewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(doc.url);
    } else {
      this.previewKind = 'unsupported';
      this.previewUrl = null;
    }
  }

  closePreview(): void {
    this.previewDocument = null;
    this.previewUrl = null;
    this.previewKind = 'unsupported';
  }

  private isAppleMobilePdfHost(): boolean {
    const ua = navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  }
}