import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonBackButton, IonButton, IonButtons, IonCheckbox, IonContent, IonHeader, IonItem, IonLabel, IonList, IonNote, IonSelect, IonSelectOption, IonSpinner, IonTextarea, IonTitle, IonToolbar, ToastController } from '@ionic/angular/standalone';
import { CARE_PLAN_PROBLEM_CATEGORIES, CarePlanCatalogEntry, CarePlanProblemCategory, splitLines, todayIsoDate } from '../../shared/care-plan';
import { CarePlanService } from '../../services/care-plan.service';

@Component({
  selector:'app-patient-care-plan',standalone:true,
  imports:[CommonModule,ReactiveFormsModule,IonBackButton,IonButton,IonButtons,IonCheckbox,IonContent,IonHeader,IonItem,IonLabel,IonList,IonNote,IonSelect,IonSelectOption,IonSpinner,IonTextarea,IonTitle,IonToolbar],
  template:`<ion-header class="ion-no-border"><ion-toolbar><ion-buttons slot="start"><ion-back-button defaultHref="/tabs/patients"></ion-back-button></ion-buttons><ion-title>Care Plan</ion-title></ion-toolbar></ion-header>
  <ion-content><div class="page"><section class="hero"><p class="eyebrow">CARE COORDINATION</p><h1>Build the patient plan from your organization catalog</h1><p>Goals come from org-admin curated content. Custom goals remain explicitly marked as custom.</p></section>
  <form [formGroup]="form">
    <ion-item lines="full"><ion-select formControlName="category" label="Problem category" labelPlacement="stacked"><ion-select-option *ngFor="let c of categories" [value]="c.value">{{c.label}}</ion-select-option></ion-select></ion-item>
    <ion-item lines="full"><ion-textarea formControlName="title" label="Plan title" labelPlacement="stacked" autoGrow="true"></ion-textarea></ion-item>
    <ion-item lines="full"><ion-textarea formControlName="description" label="Clinical context / description" labelPlacement="stacked" autoGrow="true"></ion-textarea></ion-item>
    <div class="catalog"><p class="eyebrow dark">ORG-ADMIN GOALS</p><div *ngIf="!catalogLoaded" class="center"><ion-spinner></ion-spinner> Loading goals…</div><div *ngIf="catalogLoaded && !goalOptions.length" class="empty">No published goals for this category.</div><ion-list *ngIf="goalOptions.length"><ion-item lines="none" *ngFor="let goal of goalOptions"><ion-checkbox slot="start" [checked]="isGoalSelected(goal.id)" (ionChange)="toggleGoal(goal.id,$event.detail.checked)"></ion-checkbox><ion-label>{{goal.text}}</ion-label></ion-item></ion-list></div>
    <ion-item lines="full"><ion-textarea formControlName="customGoals" label="Custom goals — one per line" labelPlacement="stacked" autoGrow="true"></ion-textarea></ion-item>
    <ion-note>Custom text is stored separately from the curated catalog so it cannot be mistaken for an admin-published standard.</ion-note>
    <div class="error" *ngIf="errorMsg">{{errorMsg}}</div>
    <ion-button expand="block" size="large" [disabled]="saving || form.invalid" (click)="save()"><ion-spinner *ngIf="saving" name="crescent"></ion-spinner><span *ngIf="!saving">Save care plan</span></ion-button>
  </form></div></ion-content>`,
  styles:[`.page{max-width:820px;margin:0 auto;padding:16px 14px 40px;background:#f4f7f9;min-height:100%}.hero{padding:22px;border-radius:24px;background:linear-gradient(145deg,#173f60,#0a7654);color:#fff;margin-bottom:14px}.hero h1{font-size:25px;margin:5px 0}.hero p{margin:0;opacity:.82}.eyebrow{font-size:10px;letter-spacing:.14em;font-weight:800}.eyebrow.dark{color:#64748b}.catalog{background:#fff;border-radius:18px;padding:14px;margin:14px 0;box-shadow:0 5px 22px rgba(18,46,67,.06)}.empty,.error{padding:12px;border-radius:12px;margin:8px 0}.empty{background:#f8fafc;color:#64748b}.error{background:#fff1f0;color:#9d2b25}.center{display:flex;align-items:center;gap:8px}`]
})
export class PatientCarePlanPage implements OnInit{
  private fb=inject(FormBuilder);private route=inject(ActivatedRoute);private router=inject(Router);private carePlans=inject(CarePlanService);private toast=inject(ToastController);
  patientId=this.route.snapshot.paramMap.get('patientId')||'';categories=CARE_PLAN_PROBLEM_CATEGORIES;catalog:CarePlanCatalogEntry[]=[];catalogLoaded=false;selectedGoalIds=new Set<string>();saving=false;errorMsg='';
  form=this.fb.group({title:['',Validators.required],category:['' as CarePlanProblemCategory|'',Validators.required],description:[''],customGoals:[''],startDate:[todayIsoDate(),Validators.required]});
  get goalOptions(){const c=this.form.value.category;if(!c)return[];return this.catalog.filter(i=>i.kind==='goal'&&i.category===c);}
  ngOnInit(){void this.loadCatalog();}
  async loadCatalog(){try{this.catalog=await this.carePlans.listCatalog();}catch{this.catalog=[];}finally{this.catalogLoaded=true;}}
  toggleGoal(id:string,checked:boolean){checked?this.selectedGoalIds.add(id):this.selectedGoalIds.delete(id)}isGoalSelected(id:string){return this.selectedGoalIds.has(id)}
  async save(){if(this.form.invalid||this.saving)return;const customGoals=splitLines(this.form.value.customGoals);const refs=[...this.selectedGoalIds];if(!customGoals.length&&!refs.length){this.errorMsg='Pick at least one organization goal or write a custom goal.';return;}this.saving=true;this.errorMsg='';try{await this.carePlans.create(this.patientId,{title:this.form.value.title!,description:this.form.value.description||null,startDate:this.form.value.startDate!,woundId:null,category:this.form.value.category as CarePlanProblemCategory,goalCatalogRefs:refs,customGoals});const t=await this.toast.create({message:'Care plan saved',duration:2200,color:'success'});await t.present();await this.router.navigate(['/tabs','skin-wound',this.patientId,'assessments']);}catch(e:any){this.errorMsg=e?.message||'Could not save care plan.';}finally{this.saving=false;}}
}
