import { CommonModule } from '@angular/common';
import { Component, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import {
  IonBackButton, IonBadge, IonButton, IonButtons, IonContent, IonHeader, IonIcon,
  IonItem, IonLabel, IonList, IonSelect, IonSelectOption, IonSpinner, IonTextarea,
  IonTitle, IonToolbar,
} from '@ionic/angular/standalone';
import { documentAttachOutline } from 'ionicons/icons';

import { MobilePatientDocument, MobilePatientDocumentService } from '../../services/mobile-patient-document.service';
import { PatientService } from '../../services/patient.service';
import { VisitSignaturePadComponent } from '../../shared/visit-signature-pad.component';

@Component({
  selector: 'app-patient-documents',
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle,
    IonContent, IonItem, IonSelect, IonSelectOption, IonTextarea, IonButton, IonSpinner,
    IonList, IonLabel, IonIcon, IonBadge, VisitSignaturePadComponent,
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
          <p class="hint">For RN/NP clinical use: upload a completed, signed consent form or other supporting document. Selecting a consent type does not record patient agreement or authorize a procedure.</p>
          <ion-item>
            <ion-select label="Document type" labelPlacement="stacked" [(ngModel)]="docType">
              <ion-select-option value="referral">Referral</ion-select-option>
              <ion-select-option value="facesheet">Face sheet</ion-select-option>
              <ion-select-option value="authorization">Authorization</ion-select-option>
              <ion-select-option value="insurance">Insurance card</ion-select-option>
              <ion-select-option value="dischargeSummary">Discharge summary</ion-select-option>
              <ion-select-option value="consent">Consent (other)</ion-select-option>
              <ion-select-option value="consent_to_treat">Consent to Treat</ion-select-option>
              <ion-select-option value="consent_telehealth">Telehealth Informed Consent</ion-select-option>
              <ion-select-option value="consent_debridement">Debridement Informed Consent</ion-select-option>
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


        <section class="card">
          <div class="head"><div><p class="eyebrow dark">PATIENT CONSENT</p><h2>Review and sign a consent</h2></div></div>
          <p class="hint">Read the entire consent with the patient. A signature must be voluntary; refusal does not create an authorization.</p>
          <ion-item>
            <ion-select label="Consent form" labelPlacement="stacked" [(ngModel)]="consentKind" (ionChange)="resetConsent()">
              <ion-select-option value="consent_to_treat">Consent to Treat</ion-select-option>
              <ion-select-option value="consent_telehealth">Telehealth Informed Consent</ion-select-option>
              <ion-select-option value="consent_debridement">Debridement Informed Consent</ion-select-option>
            </ion-select>
          </ion-item>
          <div class="consent-text" style="white-space:pre-wrap;font-size:13px;line-height:1.55;padding:14px;background:#f7fafc;border-radius:12px">{{ consentText }}</div>
          <ion-item><ion-select label="Signer" labelPlacement="stacked" [(ngModel)]="signerCapacity">
            <ion-select-option value="patient">Patient</ion-select-option>
            <ion-select-option value="representative">Authorized representative</ion-select-option>
          </ion-select></ion-item>
          <ion-item><ion-textarea label="Signer full name" labelPlacement="stacked" [(ngModel)]="signerName"></ion-textarea></ion-item>
          <ion-item *ngIf="signerCapacity === 'representative'"><ion-textarea label="Representative relationship / authority" labelPlacement="stacked" [(ngModel)]="representativeAuthority"></ion-textarea></ion-item>
          <ion-item *ngIf="consentKind === 'consent_debridement'"><ion-textarea label="Wound site, proposed technique, clinician, and alternatives discussed" labelPlacement="stacked" [(ngModel)]="procedureDetails"></ion-textarea></ion-item>
          <ion-item><ion-textarea label="Clinician who explained the consent" labelPlacement="stacked" [(ngModel)]="explainingClinician"></ion-textarea></ion-item>
          <app-visit-signature-pad (signatureChange)="consentSignature = $event"></app-visit-signature-pad>
          <ion-button expand="block" [disabled]="savingConsent || !consentSignature || !signerName.trim() || !explainingClinician.trim() || (signerCapacity === 'representative' && !representativeAuthority.trim()) || (consentKind === 'consent_debridement' && !procedureDetails.trim())" (click)="saveConsent()">
            <ion-spinner *ngIf="savingConsent"></ion-spinner> Save signed consent to chart
          </ion-button>
          <p class="hint">Saved as a signed image of the full text and signature in Patient Documents. A new signature is required for each consent; no automatic authorization is inferred.</p>
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
  documents: MobilePatientDocument[] = [];
  selectedFiles: File[] = [];
  docType = 'other';
  @ViewChild(VisitSignaturePadComponent) signaturePad?: VisitSignaturePadComponent;
  consentKind: 'consent_to_treat' | 'consent_telehealth' | 'consent_debridement' = 'consent_to_treat';
  signerCapacity: 'patient' | 'representative' = 'patient';
  signerName = '';
  representativeAuthority = '';
  explainingClinician = '';
  procedureDetails = '';
  consentSignature: string | null = null;
  savingConsent = false;
  readonly consentTexts: Record<string, string> = {
  "consent_to_treat": "PERRY HOME WOUND CARE LLC\nPrivate Home Care Provider | Skilled Nursing & Specialized Wound Care\nCONSENT TO TREAT\nGeneral consent for assessment and non-emergency wound-care services at home\n\nServices covered\nI authorize PHWC clinicians acting within their licenses and authorized orders to obtain health history and vital signs, assess wounds and skin, photograph wounds when separately authorized below, cleanse wounds, apply or change dressings, provide education, coordinate care with my treating clinicians, and perform other specifically ordered non-emergency nursing services. A nurse practitioner or other qualified clinician may evaluate me and recommend a treatment plan. This form does not itself authorize surgery, sharp debridement, anesthesia, or procedures requiring a separate informed consent.\n\nExpected benefits and material risks\nThe goal is to assess healing, protect tissue, manage drainage and symptoms, and identify complications. Possible risks include discomfort, skin irritation or allergy, bleeding during routine care, infection, delayed healing, and unexpected reactions. Results and healing cannot be guaranteed.\n\nAlternatives and patient choice\nAlternatives may include care through my physician, a wound clinic, a licensed home health agency when appropriate, or declining recommended services. I may ask questions, request a different plan, or refuse an intervention. PHWC may recommend referral or emergency evaluation when home treatment is insufficient.\n\nCare coordination and records\nI understand relevant information may be shared with members of my care team, referring providers, pharmacies, payers, and other parties as permitted by law and PHWC privacy practices. This consent does not replace any required HIPAA authorization. I acknowledge I have been offered information about privacy practices and how to raise concerns.\n\nWound photography — optional choice\nChoose one: I consent to clinically necessary wound photographs stored in the protected medical record and shared for treatment as permitted by law. OR I decline optional wound photography. I understand certain clinically necessary documentation may need to be discussed separately.\n\nFinancial information\nI understand coverage, prior authorization, referrals, and patient responsibility depend on my insurance and the services actually provided. Signing this clinical consent does not guarantee insurance payment or authorize charges not otherwise disclosed.\n\nAcknowledgment and signatures\nI have had an opportunity to ask questions. My questions were answered in language I understand. I understand I may refuse or withdraw consent, subject to clinical and legal limitations, without losing the right to discuss other appropriate care options.",
  "consent_telehealth": "PERRY HOME WOUND CARE LLC\nPrivate Home Care Provider | Skilled Nursing & Specialized Wound Care\nTELEHEALTH INFORMED CONSENT\nRemote wound-care consultation with a qualified clinician\n\nWhat telehealth involves\nI agree to a real-time audio/video consultation with an identified PHWC nurse practitioner or other authorized clinician. An RN or other staff member may be physically present to assist with camera positioning, measurements, wound assessment, and communication. I will be told the names and roles of participants. Telehealth may be used only when clinically appropriate and permitted by applicable law, payer rules, and professional scope.\n\nBenefits and limitations\nTelehealth may improve timely access to specialist input and care-plan review. Video and audio may not reveal odor, temperature, depth, circulation, or other findings reliably; image quality, internet interruptions, and incomplete information can affect clinical decisions. The clinician may stop the remote visit, require an in-person assessment, or recommend urgent/emergency care.\n\nPrivacy and technology\nPHWC will use an approved secure communication workflow and take reasonable measures to protect confidentiality. Electronic communication carries risks of technical failure or unauthorized access despite safeguards. I should participate from a reasonably private location. Recording, screenshots, or use of images outside the medical record require separate permission as applicable.\n\nChoice, alternatives, and emergencies\nI may decline telehealth and request discussion of in-person options. I may stop a telehealth encounter at any time. Telehealth is not an emergency service; for a medical emergency, call 911. If a connection fails, the team may attempt to reconnect or arrange an alternative visit.\n\nBilling and provider location\nI understand telehealth may be billed differently depending on the payer and service. PHWC will verify eligibility and required consent/documentation; this consent does not establish reimbursement eligibility. The clinician will document the patient and clinician locations, modality, participants, clinical findings, and follow-up plan.\n\nConsent choice\nI consent to telehealth consultations as described above. OR I decline telehealth consultations.\n\nAcknowledgment and signatures\nI have had an opportunity to ask questions. My questions were answered in language I understand. I understand I may refuse or withdraw consent, subject to clinical and legal limitations, without losing the right to discuss other appropriate care options.",
  "consent_debridement": "PERRY HOME WOUND CARE LLC\nPrivate Home Care Provider | Skilled Nursing & Specialized Wound Care\nDEBRIDEMENT INFORMED CONSENT\nProcedure-specific consent — complete before each planned procedure or treatment series as appropriate\n\nWound location / laterality:\nDiagnosis / clinical indication:\nProposed clinician / credentials:\nPlanned method (select and specify): Conservative sharp; Sharp/surgical; Mechanical; Enzymatic; Autolytic; Other.\nPlanned depth / tissue targeted:\nAnesthesia/analgesia plan:\n\nProcedure and purpose\nDebridement removes selected devitalized tissue or debris to support wound assessment and management. The clinician has explained the planned method, extent, anticipated discomfort, and whether repeated treatments may be necessary. Only a clinician legally authorized and appropriately trained for the proposed method may perform it.\n\nPotential benefits\nPossible benefits include removal of nonviable tissue, improved visualization of the wound bed, and support for the treatment plan. Healing, infection resolution, and avoidance of hospitalization or amputation are not guaranteed.\n\nMaterial risks\nRisks may include pain, bleeding, injury to healthy tissue or deeper structures, infection or worsening infection, delayed healing, allergic or medication reactions, and the need for additional procedures or urgent evaluation. Risk may be greater with poor circulation, diabetes, neuropathy, anticoagulant use, or other medical conditions. The clinician will review patient-specific risks before proceeding.\n\nAlternatives\nAlternatives include no debridement at this time, continued dressings and monitoring, autolytic or enzymatic methods when suitable, specialist referral, or treatment in a facility with additional resources. Some wounds, including certain ischemic wounds or stable dry eschar, may require vascular/specialist assessment before debridement.\n\nPatient-specific discussion\nRelevant conditions, medications, allergies, circulation assessment, and risks reviewed:\n\nAuthorization\nI authorize the above named qualified clinician to perform the debridement method and scope explained to me. I understand the clinician will reassess safety immediately before treatment and stop or refer if findings make the planned procedure inappropriate. Any materially different procedure requires a new discussion and consent.\n\nI consent to the procedure described above. OR I decline the proposed procedure.\n\nAcknowledgment and signatures\nI have had an opportunity to ask questions. My questions were answered in language I understand. I understand I may refuse or withdraw consent, subject to clinical and legal limitations, without losing the right to discuss other appropriate care options."
};
  get consentText(): string {
    return 'Patient: ' + this.patientName + ' | Patient ID: ' + this.patientId + '\\n\\n' + this.consentTexts[this.consentKind];
  }
  resetConsent(): void { this.consentSignature = null; this.signaturePad?.clear(); }
  async saveConsent(): Promise<void> {
    if (!this.consentSignature || !this.signerName.trim() || !this.explainingClinician.trim() ||
      (this.signerCapacity === 'representative' && !this.representativeAuthority.trim()) ||
      (this.consentKind === 'consent_debridement' && !this.procedureDetails.trim())) return;
    this.savingConsent = true; this.error = ''; this.message = '';
    try {
      const signedAt = new Date().toISOString();
      const image = new Image();
      image.src = this.consentSignature;
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Signature image unavailable.')); });
      const canvas = document.createElement('canvas'); canvas.width = 1200;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Unable to render consent.');
      const lines: string[] = [];
      const wrap = (text: string, max = 105) => { for (const paragraph of text.split('\\n')) {
        let line = ''; for (const word of paragraph.split(' ')) { if ((line + ' ' + word).length > max) { lines.push(line); line = word; } else line = line ? line + ' ' + word : word; } lines.push(line);
      }};
      wrap(this.consentText);
      wrap('\\nSigner: ' + this.signerName.trim() + ' (' + this.signerCapacity + ')');
      if (this.signerCapacity === 'representative') wrap('Authority: ' + this.representativeAuthority.trim());
      if (this.consentKind === 'consent_debridement') wrap('Procedure details: ' + this.procedureDetails.trim());
      wrap('Explained by: ' + this.explainingClinician.trim() + ' | Signed at: ' + signedAt);
      canvas.height = Math.max(850, 110 + lines.length * 29 + 260);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#173248'; ctx.font = '21px Arial';
      lines.forEach((line, i) => ctx.fillText(line, 38, 58 + i * 29));
      ctx.drawImage(image, 38, 95 + lines.length * 29, 500, 150);
      ctx.font = '16px Arial'; ctx.fillText('Patient / representative signature', 38, 270 + lines.length * 29);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Consent image generation failed.')), 'image/png'));
      const file = new File([blob], this.consentKind + '-' + signedAt.replace(/[:.]/g, '-') + '.png', {type: 'image/png'});
      await this.docs.upload(this.patientId, [file], {type: this.consentKind, description: 'Signed consent v1; ' + signedAt + '; signer: ' + this.signerName.trim() + '; clinician: ' + this.explainingClinician.trim()});
      this.documents = await this.docs.list(this.patientId);
      this.message = 'Signed consent saved to the patient chart.';
      this.signaturePad?.clear(); this.consentSignature = null; this.signerName = ''; this.representativeAuthority = ''; this.procedureDetails = '';
    } catch (e: any) { this.error = e?.message || 'Unable to save consent.'; }
    finally { this.savingConsent = false; }
  }
  docDescription = '';
  previewDocument: MobilePatientDocument | null = null;
  previewUrl: SafeResourceUrl | null = null;
  previewKind: 'image' | 'pdf' | 'unsupported' = 'unsupported';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly patients: PatientService,
    private readonly docs: MobilePatientDocumentService,
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
        this.patients.getPatient(this.patientId),
        this.docs.list(this.patientId),
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
      await this.docs.upload(this.patientId, this.selectedFiles, { type: this.docType, description: this.docDescription });
      this.selectedFiles = [];
      this.docDescription = '';
      this.documents = await this.docs.list(this.patientId);
      this.message = 'Document added to the patient chart.';
    } catch (error: any) {
      this.error = error?.message || 'Unable to upload document.';
    } finally {
      this.uploading = false;
    }
  }

  openPreview(doc: MobilePatientDocument): void {
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