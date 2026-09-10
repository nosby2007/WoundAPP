import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton, IonButton, IonButtons, IonCard, IonCardContent, IonContent,
  IonHeader, IonIcon, IonItem, IonNote, IonSpinner, IonTextarea, IonTitle,
  IonToolbar, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { bodyOutline, bulbOutline, heartOutline, shieldCheckmarkOutline } from 'ionicons/icons';
import { SystemicAssessmentService } from '../../services/systemic-assessment.service';

@Component({
  selector:'app-systemic-assessment',
  standalone:true,
  imports:[CommonModule,ReactiveFormsModule,IonBackButton,IonButton,IonButtons,IonCard,IonCardContent,IonContent,IonHeader,IonIcon,IonItem,IonNote,IonSpinner,IonTextarea,IonTitle,IonToolbar],
  template:`
  <ion-header class="ion-no-border"><ion-toolbar><ion-buttons slot="start"><ion-back-button defaultHref="/tabs/patients"></ion-back-button></ion-buttons><ion-title>Systemic Assessment</ion-title></ion-toolbar></ion-header>
  <ion-content><div class="page">
    <section class="hero"><p class="eyebrow">WHOLE-PATIENT ASSESSMENT</p><h1>Head-to-toe, mental and psychosocial picture</h1><p>Document only what you assessed. Empty sections remain undocumented; the app does not convert blanks into normal findings.</p></section>
    <form [formGroup]="form">
      <section class="grid">
        <ion-card><ion-card-content><div class="section-head"><ion-icon [icon]="bodyOutline"></ion-icon><div><h2>Head-to-Toe</h2><p>Physical systems and functional context</p></div></div>
          <ion-item lines="full"><ion-textarea formControlName="general" label="General appearance / constitutional" labelPlacement="stacked" autoGrow="true"></ion-textarea></ion-item>
          <ion-item lines="full"><ion-textarea formControlName="headToToe" label="Head-to-toe findings" labelPlacement="stacked" autoGrow="true"></ion-textarea></ion-item>
          <ion-item lines="full"><ion-textarea formControlName="neurologic" label="Neurologic" labelPlacement="stacked" autoGrow="true"></ion-textarea></ion-item>
          <ion-item lines="full"><ion-textarea formControlName="cardiovascular" label="Cardiovascular" labelPlacement="stacked" autoGrow="true"></ion-textarea></ion-item>
          <ion-item lines="full"><ion-textarea formControlName="respiratory" label="Respiratory" labelPlacement="stacked" autoGrow="true"></ion-textarea></ion-item>
          <ion-item lines="full"><ion-textarea formControlName="gastrointestinal" label="Gastrointestinal" labelPlacement="stacked" autoGrow="true"></ion-textarea></ion-item>
          <ion-item lines="full"><ion-textarea formControlName="genitourinary" label="Genitourinary" labelPlacement="stacked" autoGrow="true"></ion-textarea></ion-item>
          <ion-item lines="full"><ion-textarea formControlName="musculoskeletal" label="Musculoskeletal" labelPlacement="stacked" autoGrow="true"></ion-textarea></ion-item>
          <ion-item lines="none"><ion-textarea formControlName="integumentary" label="Skin / integumentary beyond wound findings" labelPlacement="stacked" autoGrow="true"></ion-textarea></ion-item>
        </ion-card-content></ion-card>

        <ion-card><ion-card-content><div class="section-head"><ion-icon [icon]="bulbOutline"></ion-icon><div><h2>Mental & Psychological</h2><p>Cognition, behavior, coping and psychosocial observations</p></div></div>
          <ion-item lines="full"><ion-textarea formControlName="mentalStatus" label="Mental status / cognition" labelPlacement="stacked" autoGrow="true"></ion-textarea></ion-item>
          <ion-item lines="full"><ion-textarea formControlName="psychological" label="Psychological / psychosocial" labelPlacement="stacked" autoGrow="true"></ion-textarea></ion-item>
          <ion-item lines="full"><ion-textarea formControlName="pain" label="Pain assessment context" labelPlacement="stacked" autoGrow="true"></ion-textarea></ion-item>
          <ion-item lines="full"><ion-textarea formControlName="nutritionHydration" label="Nutrition / hydration" labelPlacement="stacked" autoGrow="true"></ion-textarea></ion-item>
          <ion-item lines="full"><ion-textarea formControlName="functionalMobility" label="Functional status / mobility" labelPlacement="stacked" autoGrow="true"></ion-textarea></ion-item>
          <ion-item lines="full"><ion-textarea formControlName="safetyRisks" label="Safety / risk observations" labelPlacement="stacked" autoGrow="true"></ion-textarea></ion-item>
          <ion-item lines="none"><ion-textarea formControlName="other" label="Other findings" labelPlacement="stacked" autoGrow="true"></ion-textarea></ion-item>
        </ion-card-content></ion-card>
      </section>

      <ion-card><ion-card-content><div class="section-head"><ion-icon [icon]="heartOutline"></ion-icon><div><h2>Clinical Synthesis</h2><p>Clinician-authored summary; not generated automatically</p></div></div>
        <ion-item lines="none"><ion-textarea formControlName="clinicalSummary" label="Clinical summary / changes / concerns" labelPlacement="stacked" autoGrow="true" rows="5"></ion-textarea></ion-item>
        <div class="guard"><ion-icon [icon]="shieldCheckmarkOutline"></ion-icon><ion-note>No section is pre-populated as normal. Saving preserves the canonical clinician identity from users/UID.</ion-note></div>
      </ion-card-content></ion-card>
      <ion-button expand="block" size="large" [disabled]="saving" (click)="save()"><ion-spinner *ngIf="saving" name="crescent"></ion-spinner><span *ngIf="!saving">Save systemic assessment</span></ion-button>
    </form>
  </div></ion-content>`,
  styles:[`
  .page{max-width:1050px;margin:0 auto;padding:16px 14px 42px;background:#f4f7f9;min-height:100%}.hero{background:linear-gradient(145deg,#173f60,#0a7654);color:#fff;border-radius:24px;padding:22px;margin-bottom:14px}.hero h1{margin:5px 0;font-size:25px}.hero p{margin:0;opacity:.82;line-height:1.45}.eyebrow{font-size:10px;font-weight:800;letter-spacing:.14em}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}ion-card{border-radius:20px;box-shadow:0 5px 22px rgba(18,46,67,.06);margin:0 0 12px}.section-head{display:flex;gap:10px;align-items:center;margin-bottom:8px}.section-head ion-icon{font-size:27px;color:#0a7654}.section-head h2{margin:0;color:#10233f;font-size:18px}.section-head p{margin:2px 0;color:#718096;font-size:12px}.guard{display:flex;align-items:center;gap:8px;padding:10px;background:#eef7f3;border-radius:12px;margin-top:10px}.guard ion-icon{color:#0a7654;font-size:22px}@media(max-width:760px){.grid{grid-template-columns:1fr}}
  `]
})
export class SystemicAssessmentPage{
  private fb=inject(FormBuilder);private route=inject(ActivatedRoute);private router=inject(Router);private service=inject(SystemicAssessmentService);private toast=inject(ToastController);
  patientId=this.route.snapshot.paramMap.get('patientId')||'';saving=false;
  readonly bodyOutline=bodyOutline;readonly bulbOutline=bulbOutline;readonly heartOutline=heartOutline;readonly shieldCheckmarkOutline=shieldCheckmarkOutline;
  form=this.fb.group({general:[''],headToToe:[''],neurologic:[''],cardiovascular:[''],respiratory:[''],gastrointestinal:[''],genitourinary:[''],musculoskeletal:[''],integumentary:[''],mentalStatus:[''],psychological:[''],pain:[''],nutritionHydration:[''],functionalMobility:[''],safetyRisks:[''],other:[''],clinicalSummary:['']});
  constructor(){addIcons({bodyOutline,bulbOutline,heartOutline,shieldCheckmarkOutline});}
  async save(){if(this.saving)return;this.saving=true;try{await this.service.create(this.patientId,this.form.getRawValue());const t=await this.toast.create({message:'Systemic assessment saved',duration:2200,color:'success'});await t.present();await this.router.navigate(['/tabs','skin-wound',this.patientId,'assessments']);}catch(e:any){const t=await this.toast.create({message:e?.message||'Assessment could not be saved',duration:3200,color:'danger'});await t.present();}finally{this.saving=false;}}
}
