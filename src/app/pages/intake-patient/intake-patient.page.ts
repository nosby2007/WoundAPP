import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import {
  IonBadge, IonButton, IonContent, IonHeader, IonIcon, IonInput, IonItem,
  IonLabel, IonList, IonSelect, IonSelectOption, IonSpinner, IonTextarea,
  IonTitle, IonToolbar,
} from '@ionic/angular/standalone';
import { documentAttachOutline, saveOutline } from 'ionicons/icons';
import { MobilePatientDocument, MobilePatientDocumentService } from '../../services/mobile-patient-document.service';
import { PatientService } from '../../services/patient.service';

@Component({
  selector:'app-intake-patient',
  standalone:true,
  imports:[
    CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonContent,
    IonItem, IonInput, IonButton, IonIcon, IonSpinner, IonSelect, IonSelectOption,
    IonTextarea, IonList, IonLabel, IonBadge
  ],
  template:`
    <ion-header class="ion-no-border"><ion-toolbar><ion-title>Patient Intake</ion-title></ion-toolbar></ion-header>
    <ion-content>
      <div class="page">
        <section class="hero">
          <p class="eyebrow">ADMINISTRATIVE PATIENT WORKSPACE</p>
          <h1>{{ form.name || 'Patient' }}</h1>
          <p>Edit reception/intake details and attach documents without opening wound documentation.</p>
        </section>

        <div class="state" *ngIf="loading"><ion-spinner></ion-spinner>Loading…</div>
        <div class="error" *ngIf="error">{{ error }}</div>

        <section class="card" *ngIf="!loading">
          <div class="head"><div><p class="eyebrow dark">DEMOGRAPHICS</p><h2>Reception details</h2></div></div>
          <ion-item><ion-input label="Legal name" labelPlacement="stacked" [(ngModel)]="form.name"></ion-input></ion-item>
          <div class="grid">
            <ion-item><ion-input label="DOB" labelPlacement="stacked" type="date" [(ngModel)]="form.dob"></ion-input></ion-item>
            <ion-item><ion-input label="Phone" labelPlacement="stacked" [(ngModel)]="form.phone"></ion-input></ion-item>
          </div>
          <ion-item><ion-input label="Email" labelPlacement="stacked" [(ngModel)]="form.email"></ion-input></ion-item>
          <ion-item><ion-input label="Address" labelPlacement="stacked" [(ngModel)]="form.address"></ion-input></ion-item>
          <div class="grid">
            <ion-item><ion-input label="City" labelPlacement="stacked" [(ngModel)]="form.city"></ion-input></ion-item>
            <ion-item><ion-input label="State" labelPlacement="stacked" [(ngModel)]="form.state"></ion-input></ion-item>
            <ion-item><ion-input label="ZIP" labelPlacement="stacked" [(ngModel)]="form.zip"></ion-input></ion-item>
          </div>

          <p class="eyebrow dark section-label">INSURANCE / CONTACT</p>
          <ion-item><ion-input label="Insurance / payer" labelPlacement="stacked" [(ngModel)]="form.insuranceProvider"></ion-input></ion-item>
          <ion-item><ion-input label="Member / insurance ID" labelPlacement="stacked" [(ngModel)]="form.insuranceId"></ion-input></ion-item>
          <ion-item><ion-input label="Emergency contact" labelPlacement="stacked" [(ngModel)]="form.emergencyContactName"></ion-input></ion-item>
          <ion-item><ion-input label="Emergency phone" labelPlacement="stacked" [(ngModel)]="form.emergencyContactPhone"></ion-input></ion-item>

          <ion-button expand="block" [disabled]="saving" (click)="save()">
            <ion-spinner *ngIf="saving" name="crescent"></ion-spinner>
            <ion-icon *ngIf="!saving" slot="start" [icon]="saveOutline"></ion-icon>
            <span *ngIf="!saving">Save patient</span>
          </ion-button>
          <div class="success" *ngIf="message">{{ message }}</div>
        </section>

        <section class="card">
          <div class="head">
            <div><p class="eyebrow dark">DOCUMENTS</p><h2>Patient documents</h2></div>
            <ion-badge color="primary">{{ documents.length }}</ion-badge>
          </div>
          <p class="hint">Upload referral, face sheet, insurance card, discharge summary, consent, lab result or other intake document.</p>

          <ion-item>
            <ion-select label="Document type" labelPlacement="stacked" [(ngModel)]="docType">
              <ion-select-option value="referral">Referral</ion-select-option>
              <ion-select-option value="facesheet">Face sheet</ion-select-option>
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
          <ion-button expand="block" fill="outline" [disabled]="uploading || !selectedFiles.length" (click)="upload()">
            <ion-spinner *ngIf="uploading" name="crescent"></ion-spinner>
            <span *ngIf="!uploading">Add document</span>
          </ion-button>

          <ion-list lines="none">
            <ion-item *ngFor="let doc of documents" button detail="false" (click)="openPreview(doc)">
              <ion-icon slot="start" [icon]="documentAttachOutline"></ion-icon>
              <ion-label><strong>{{ doc.name }}</strong><p>{{ doc.type || 'other' }} · {{ doc.description || 'No description' }}</p></ion-label>
              <ion-badge slot="end" color="light">View</ion-badge>
            </ion-item>
          </ion-list>
        </section>

        <div class="preview-backdrop" *ngIf="previewDocument" (click)="closePreview()">
          <section class="preview-shell" (click)="$event.stopPropagation()">
            <header class="preview-head">
              <div>
                <p class="eyebrow dark">DOCUMENT PREVIEW</p>
                <strong>{{ previewDocument.name }}</strong>
              </div>
              <ion-button fill="clear" color="dark" size="small" (click)="closePreview()">Close</ion-button>
            </header>

            <div class="preview-body">
              <img
                *ngIf="previewKind === 'image' && previewDocument.url"
                [src]="previewDocument.url"
                [alt]="previewDocument.name"
                class="preview-image"
              />

              <iframe
                *ngIf="previewKind === 'pdf' && previewUrl"
                [src]="previewUrl"
                [title]="previewDocument.name"
                class="preview-pdf"
              ></iframe>

              <div class="preview-unsupported" *ngIf="previewKind === 'unsupported'">
                This file type cannot be previewed in the app yet.
              </div>
            </div>
          </section>
        </div>
      </div>
    </ion-content>
  `,
  styles:[`
    .page{min-height:100%;padding:16px 16px 36px;background:#f4f7fa}.hero{padding:20px;border-radius:24px;background:linear-gradient(145deg,#173d5c,#0b7251);color:#fff}.hero h1{margin:4px 0}.hero p{margin:0;opacity:.82;font-size:12px}.eyebrow{font-size:10px;letter-spacing:.14em;font-weight:800}.eyebrow.dark{color:#587188}.card{margin-top:15px;padding:16px;border-radius:20px;background:#fff;box-shadow:0 7px 22px rgba(30,55,75,.06)}.head{display:flex;justify-content:space-between;align-items:start}.head h2{margin:2px 0 10px;color:#10233f}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.card ion-item{--background:#f7fafc;border-radius:13px;margin:7px 0}.section-label{margin-top:18px}.hint{font-size:11px;color:#667b8e}.file-button{display:flex;align-items:center;gap:9px;padding:14px;border:1px dashed #8da6b8;border-radius:14px;margin:10px 0;color:#173d5c;font-size:12px;font-weight:700}.file-button input{display:none}.success{background:#ecfdf5;color:#166534;border-radius:11px;padding:10px;margin-top:8px}.error{background:#fff1f2;color:#9f1239;border-radius:11px;padding:10px}.state{text-align:center;padding:25px;color:#667b8e}
    .preview-backdrop{position:fixed;inset:0;z-index:9999;background:rgba(7,22,36,.78);display:grid;place-items:center;padding:12px}
    .preview-shell{width:min(980px,100%);height:min(88vh,900px);background:#fff;border-radius:22px;overflow:hidden;display:grid;grid-template-rows:auto 1fr;box-shadow:0 28px 70px rgba(0,0,0,.35)}
    .preview-head{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid #e6ece9}.preview-head strong{display:block;color:#10233f;max-width:70vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .preview-body{min-height:0;overflow:auto;display:grid;place-items:center;background:#eef3f1}.preview-image{max-width:100%;max-height:100%;object-fit:contain}.preview-pdf{width:100%;height:100%;border:0;background:#fff}.preview-unsupported{padding:24px;color:#64748b;text-align:center}
    @media(max-width:620px){.grid{grid-template-columns:1fr}.preview-backdrop{padding:0}.preview-shell{width:100vw;height:100vh;border-radius:0}}
  `]
})
export class IntakePatientPage {
  readonly documentAttachOutline=documentAttachOutline;
  readonly saveOutline=saveOutline;
  patientId='';
  loading=true; saving=false; uploading=false;
  error=''; message='';
  documents:MobilePatientDocument[]=[];
  selectedFiles:File[]=[];
  previewDocument:MobilePatientDocument|null=null;
  previewUrl:SafeResourceUrl|null=null;
  previewKind:'image'|'pdf'|'unsupported'='unsupported';
  docType='referral'; docDescription='';
  form:any={name:'',dob:'',phone:'',email:'',address:'',city:'',state:'',zip:'',insuranceProvider:'',insuranceId:'',emergencyContactName:'',emergencyContactPhone:''};

  constructor(
    private route:ActivatedRoute,
    private patients:PatientService,
    private docs:MobilePatientDocumentService,
    private sanitizer:DomSanitizer
  ){}

  ionViewWillEnter():void{
    this.patientId=this.route.snapshot.paramMap.get('patientId')||'';
    void this.load();
  }

  async load():Promise<void>{
    this.loading=true; this.error='';
    try{
      const [patient,documents]=await Promise.all([this.patients.getPatient(this.patientId),this.docs.list(this.patientId)]);
      this.form={
        name:patient.name||'',
        dob:this.dateInput(patient.dob),
        phone:patient.phone||'',
        email:patient.email||'',
        address:patient.address||patient['address1']||'',
        city:patient.city||'',
        state:patient.state||'',
        zip:patient.zip||'',
        insuranceProvider:patient.insuranceProvider||patient.payor||'',
        insuranceId:patient.insuranceId||'',
        emergencyContactName:patient.emergencyContactName||'',
        emergencyContactPhone:patient.emergencyContactPhone||''
      };
      this.documents=documents;
    }catch(e:any){this.error=e?.message||'Unable to load patient.'}
    finally{this.loading=false}
  }

  async save():Promise<void>{
    this.saving=true; this.error=''; this.message='';
    try{
      await this.patients.updateIntakePatient(this.patientId,{
        ...this.form,
        address1:this.form.address
      });
      this.message='Patient intake information saved.';
    }catch(e:any){this.error=e?.message||'Unable to save patient.'}
    finally{this.saving=false}
  }

  onFiles(event:Event):void{
    const input=event.target as HTMLInputElement;
    this.selectedFiles=Array.from(input.files||[]);
  }

  async upload():Promise<void>{
    if(!this.selectedFiles.length)return;
    this.uploading=true; this.error=''; this.message='';
    try{
      await this.docs.upload(this.patientId,this.selectedFiles,{type:this.docType,description:this.docDescription});
      this.selectedFiles=[]; this.docDescription='';
      this.documents=await this.docs.list(this.patientId);
      this.message='Document added to the patient chart.';
    }catch(e:any){this.error=e?.message||'Unable to upload document.'}
    finally{this.uploading=false}
  }


  openPreview(doc:MobilePatientDocument):void{
    this.previewDocument=doc;
    const mime=(doc.mimeType||'').toLowerCase();
    const name=(doc.name||'').toLowerCase();
    if(mime.startsWith('image/')||/\.(png|jpe?g|gif|webp|bmp|tiff?)$/i.test(name)){
      this.previewKind='image';
      this.previewUrl=this.sanitizer.bypassSecurityTrustResourceUrl(doc.url);
      return;
    }
    if(mime==='application/pdf'||/\.pdf$/i.test(name)){
      this.previewKind='pdf';
      this.previewUrl=this.sanitizer.bypassSecurityTrustResourceUrl(doc.url);
      return;
    }
    this.previewKind='unsupported';
    this.previewUrl=null;
  }

  closePreview():void{
    this.previewDocument=null;
    this.previewUrl=null;
    this.previewKind='unsupported';
  }

  private dateInput(value:any):string{
    if(!value)return'';
    const d=value?.toDate?value.toDate():new Date(value);
    if(Number.isNaN(d.getTime()))return'';
    return d.toISOString().slice(0,10);
  }
}
