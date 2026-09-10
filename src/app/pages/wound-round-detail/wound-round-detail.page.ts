import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonBadge, IonButton, IonContent, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonNote, IonSpinner, IonTitle, IonToolbar, ToastController } from '@ionic/angular/standalone';
import { arrowBackOutline, checkmarkCircleOutline, chevronForwardOutline, clipboardOutline, documentTextOutline, personOutline, playCircleOutline, shieldCheckmarkOutline, sparklesOutline } from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { MobileRoundPatient, MobileWoundRound, WoundRoundMobileService } from '../../services/wound-round.service';

const ROUND_ASSESSMENT_CONTEXT_KEY = 'woundapp.roundAssessmentContext';

@Component({
  selector:'app-wound-round-detail',
  standalone:true,
  imports:[CommonModule,FormsModule,IonHeader,IonToolbar,IonTitle,IonContent,IonButton,IonIcon,IonBadge,IonItem,IonLabel,IonInput,IonSpinner,IonNote],
  template:`
    <ion-header class="ion-no-border"><ion-toolbar><ion-button slot="start" fill="clear" (click)="back()"><ion-icon [icon]="arrowBackOutline"></ion-icon></ion-button><ion-title>{{ round?.facilityName || 'Round' }}</ion-title></ion-toolbar></ion-header>
    <ion-content>
      <div class="page" *ngIf="round as r; else loadingTpl">
        <section class="hero">
          <div><p class="eyebrow">ROUND MODE · {{ r.roundDate }}</p><h1>{{ r.facilityName }}</h1><p>{{ resolved }} of {{ r.patients.length }} patients resolved</p></div>
          <div class="progress-ring"><strong>{{ percent }}%</strong><span>complete</span></div>
        </section>

        <div class="workspace">
          <aside class="rail">
            <div class="rail-head"><p class="eyebrow dark">PATIENT QUEUE</p><h2>Round roster</h2></div>
            <button class="patient-row" *ngFor="let p of pending" [class.active]="selected?.patientId===p.patientId" (click)="select(p)"><span class="room">{{ p.roomNumber || '—' }}</span><span class="identity"><strong>{{ p.patientName }}</strong><small>{{ p.unit || 'Room ' + (p.roomNumber || '—') }}</small></span><ion-badge [color]="p.status==='in_progress'?'warning':'medium'">{{ p.status }}</ion-badge></button>
            <div class="evaluated-title" *ngIf="evaluated.length">Evaluated</div>
            <button class="patient-row done" *ngFor="let p of evaluated" [class.active]="selected?.patientId===p.patientId" (click)="select(p)"><span class="room"><ion-icon [icon]="checkmarkCircleOutline"></ion-icon></span><span class="identity"><strong>{{ p.patientName }}</strong><small>{{ p.assessmentIds?.length || 0 }} assessment(s)</small></span><ion-badge color="success">{{ p.status }}</ion-badge></button>
          </aside>

          <main class="patient-work" *ngIf="selected as p; else chooseTpl">
            <div class="patient-head"><div><p class="eyebrow dark">CURRENT PATIENT</p><h2>{{ p.patientName }}</h2><p>Room {{ p.roomNumber || '—' }} <span *ngIf="p.unit">· {{ p.unit }}</span></p></div><ion-badge [color]="statusColor(p.status)">{{ p.status }}</ion-badge></div>
            <section class="clinical-card">
              <div class="clinical-stat"><span>Assessments linked</span><strong>{{ p.assessmentIds?.length || 0 }}</strong></div><div class="clinical-stat"><span>Wounds linked</span><strong>{{ p.woundIds?.length || 0 }}</strong></div><div class="clinical-stat"><span>QA state</span><strong>{{ p.qaStatus || 'not_ready' }}</strong></div>
            </section>
            <section class="action-grid" *ngIf="canAuthor && r.status==='in_progress'">
              <ion-button fill="outline" (click)="openChart(p)"><ion-icon slot="start" [icon]="documentTextOutline"></ion-icon>Open chart</ion-button>
              <ion-button [disabled]="busy" (click)="newAssessment(p)"><ion-icon slot="start" [icon]="clipboardOutline"></ion-icon>New wound assessment</ion-button>
              <ion-button color="success" [disabled]="busy || p.status==='evaluated'" (click)="evaluate(p)"><ion-icon slot="start" [icon]="checkmarkCircleOutline"></ion-icon>Complete evaluation</ion-button>
            </section>
            <section class="skip" *ngIf="canAuthor && r.status==='in_progress' && p.status!=='evaluated' && p.status!=='seen' && p.status!=='skipped'">
              <ion-item lines="none"><ion-input label="If patient cannot be evaluated" labelPlacement="stacked" placeholder="Required reason to skip" [(ngModel)]="skipReason"></ion-input></ion-item>
              <ion-button fill="clear" color="medium" [disabled]="!skipReason.trim() || busy" (click)="skip(p)">Skip patient</ion-button>
            </section>
            <section class="readonly" *ngIf="!canAuthor"><ion-icon [icon]="shieldCheckmarkOutline"></ion-icon><p>Review-only access. Clinical authoring actions are unavailable for this role.</p></section>
          </main>

          <aside class="summary">
            <p class="eyebrow dark">ROUND SUMMARY</p><div class="big"><strong>{{ r.patients.length }}</strong><span>Total patients</span></div>
            <div class="summary-row"><span>Pending</span><b>{{ pendingOnly }}</b></div><div class="summary-row"><span>In progress</span><b>{{ inProgress }}</b></div><div class="summary-row"><span>Evaluated</span><b>{{ evaluatedOnly }}</b></div><div class="summary-row"><span>Skipped</span><b>{{ skipped }}</b></div>
            <div class="qa"><ion-icon [icon]="sparklesOutline"></ion-icon><div><strong>QA readiness</strong><p>{{ resolved===r.patients.length ? 'Round can be closed and sent to QA.' : 'Resolve every patient before closing.' }}</p></div></div>
            <ion-button *ngIf="canAuthor && r.status==='in_progress'" expand="block" color="success" [disabled]="resolved!==r.patients.length || busy" (click)="completeRound()"><ion-spinner *ngIf="busy" name="crescent"></ion-spinner><span *ngIf="!busy">Finish round</span></ion-button>
            <ion-note *ngIf="r.status==='completed'">Completed · QA {{ r.qaStatus || 'ready' }}</ion-note>
          </aside>
        </div>
      </div>
      <ng-template #loadingTpl><div class="loading"><ion-spinner></ion-spinner><p>Opening wound round…</p></div></ng-template>
      <ng-template #chooseTpl><div class="choose"><ion-icon [icon]="personOutline"></ion-icon><h2>Select a patient</h2><p>Choose the next resident in the round queue.</p></div></ng-template>
    </ion-content>
  `,
  styles:[`
    :host{--ink:#10233f;--muted:#687b8f;--green:#087455;--navy:#173d5d}ion-toolbar{--background:#fff;--color:var(--ink)}.page{background:#f3f7f9;min-height:100%;padding:14px 14px 40px}.hero{background:linear-gradient(145deg,#0a7654,#163b5c 80%);color:#fff;border-radius:27px;padding:20px 23px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 16px 38px rgba(20,62,84,.18)}.hero h1{font-size:27px;margin:3px 0}.hero p{margin:0;opacity:.78}.eyebrow{font-size:9px;letter-spacing:.16em;font-weight:850;margin:0}.eyebrow.dark{color:#60798e}.progress-ring{width:82px;height:82px;border-radius:50%;border:7px solid rgba(255,255,255,.19);display:grid;place-items:center;align-content:center}.progress-ring strong{font-size:20px}.progress-ring span{font-size:8px;opacity:.7}.workspace{display:grid;grid-template-columns:minmax(230px,290px) minmax(360px,1fr) minmax(210px,270px);gap:12px;margin-top:13px;align-items:start}.rail,.patient-work,.summary{background:#fff;border-radius:24px;box-shadow:0 6px 22px rgba(30,55,75,.06);padding:15px}.rail-head h2,.patient-head h2{margin:3px 0;color:var(--ink)}.patient-row{width:100%;border:0;background:#f7fafb;border-radius:15px;padding:10px;margin:7px 0;display:grid;grid-template-columns:40px 1fr auto;gap:8px;align-items:center;text-align:left}.patient-row.active{background:#eaf6f1;box-shadow:inset 0 0 0 1px #c8e8da}.patient-row.done{opacity:.82}.room{width:38px;height:38px;border-radius:12px;background:#edf4f8;color:#315d7d;display:grid;place-items:center;font-size:11px;font-weight:800}.done .room{background:#e9f7ef;color:var(--green)}.identity strong{display:block;color:var(--ink);font-size:12px}.identity small{font-size:9px;color:var(--muted)}.evaluated-title{font-size:9px;text-transform:uppercase;letter-spacing:.12em;font-weight:800;color:#8193a1;margin:16px 4px 7px}.patient-head{display:flex;justify-content:space-between;align-items:start}.patient-head p{margin:0;color:var(--muted);font-size:11px}.clinical-card{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin:18px 0}.clinical-stat{background:#f6f9fb;border-radius:16px;padding:13px}.clinical-stat span{font-size:9px;color:var(--muted);text-transform:uppercase}.clinical-stat strong{display:block;color:var(--ink);font-size:16px;margin-top:4px}.action-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.action-grid ion-button:last-child{grid-column:1/-1}.skip{border-top:1px solid #edf1f3;margin-top:18px;padding-top:12px}.skip ion-item{--background:#fafbfc;border-radius:14px}.readonly{display:flex;gap:9px;align-items:center;background:#fff7e6;color:#74591f;border-radius:15px;padding:12px;margin-top:16px}.readonly p{font-size:10px}.summary .big{background:#eef7f3;border-radius:18px;padding:15px;margin:10px 0}.big strong{display:block;font-size:28px;color:var(--green)}.big span{font-size:9px;color:var(--muted);text-transform:uppercase}.summary-row{display:flex;justify-content:space-between;padding:9px 3px;border-bottom:1px solid #eef2f4;font-size:11px;color:var(--muted)}.summary-row b{color:var(--ink)}.qa{display:flex;gap:9px;background:#f4f7fb;border-radius:16px;padding:12px;margin:15px 0}.qa ion-icon{color:#597d9a;font-size:22px}.qa strong{font-size:11px;color:var(--ink)}.qa p{margin:2px 0;font-size:9px;color:var(--muted)}.loading,.choose{min-height:58vh;display:grid;place-items:center;align-content:center;text-align:center;color:var(--muted)}.choose ion-icon{font-size:42px;color:var(--green)}.choose h2{color:var(--ink)}@media(max-width:900px){.workspace{grid-template-columns:260px 1fr}.summary{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.summary>.eyebrow,.summary>.big,.summary>.qa,.summary>ion-button,.summary>ion-note{grid-column:1/-1}}@media(max-width:680px){.workspace{grid-template-columns:1fr}.rail,.patient-work,.summary{grid-column:auto}.summary{display:block}.clinical-card{grid-template-columns:1fr 1fr}.action-grid{grid-template-columns:1fr}.action-grid ion-button:last-child{grid-column:auto}}
  `]
})
export class WoundRoundDetailPage implements OnInit,OnDestroy{
  readonly arrowBackOutline=arrowBackOutline;readonly checkmarkCircleOutline=checkmarkCircleOutline;readonly chevronForwardOutline=chevronForwardOutline;readonly clipboardOutline=clipboardOutline;readonly documentTextOutline=documentTextOutline;readonly personOutline=personOutline;readonly playCircleOutline=playCircleOutline;readonly shieldCheckmarkOutline=shieldCheckmarkOutline;readonly sparklesOutline=sparklesOutline;
  round:MobileWoundRound|null=null;selected:MobileRoundPatient|null=null;canAuthor=false;busy=false;skipReason='';private sub?:Subscription;private roundId='';
  constructor(private route:ActivatedRoute,private router:Router,private rounds:WoundRoundMobileService,private toast:ToastController){}
  async ngOnInit(){this.roundId=this.route.snapshot.paramMap.get('roundId')||'';this.canAuthor=await this.rounds.canAuthor().catch(()=>false);this.sub=this.rounds.round$(this.roundId).subscribe({next:r=>{this.round=r;if(r&&!this.selected)this.selected=r.patients.find(p=>p.status==='in_progress')||r.patients.find(p=>p.status==='pending')||r.patients[0]||null;else if(r&&this.selected)this.selected=r.patients.find(p=>p.patientId===this.selected?.patientId)||null},error:async()=>this.message('Unable to open round','danger')});}
  ngOnDestroy(){this.sub?.unsubscribe()}
  get pending(){return(this.round?.patients||[]).filter(p=>p.status==='pending'||p.status==='in_progress')}
  get evaluated(){return(this.round?.patients||[]).filter(p=>['evaluated','seen','skipped'].includes(p.status))}
  get resolved(){return this.evaluated.length}get percent(){const n=this.round?.patients.length||0;return n?Math.round(this.resolved/n*100):0}get pendingOnly(){return(this.round?.patients||[]).filter(p=>p.status==='pending').length}get inProgress(){return(this.round?.patients||[]).filter(p=>p.status==='in_progress').length}get evaluatedOnly(){return(this.round?.patients||[]).filter(p=>p.status==='evaluated'||p.status==='seen').length}get skipped(){return(this.round?.patients||[]).filter(p=>p.status==='skipped').length}
  select(p:MobileRoundPatient){this.selected=p;this.skipReason=''}
  statusColor(s:string){return s==='evaluated'||s==='seen'?'success':s==='skipped'?'medium':s==='in_progress'?'warning':'primary'}
  async newAssessment(p:MobileRoundPatient){
    this.busy=true;
    try{
      if(p.status==='pending')await this.rounds.markPatient(this.roundId,p.patientId,'in_progress');
      sessionStorage.setItem(ROUND_ASSESSMENT_CONTEXT_KEY,JSON.stringify({roundId:this.roundId,patientId:p.patientId,startedAt:Date.now()}));
      const navigated=await this.router.navigate(['/tabs','skin-wound',p.patientId,'assessments','new'],{queryParams:{roundId:this.roundId}});
      if(!navigated){sessionStorage.removeItem(ROUND_ASSESSMENT_CONTEXT_KEY);throw new Error('Could not open wound assessment');}
    }catch(e:any){sessionStorage.removeItem(ROUND_ASSESSMENT_CONTEXT_KEY);await this.message(e?.message||'Could not start patient','danger')}
    finally{this.busy=false}
  }
  openChart(p:MobileRoundPatient){void this.router.navigate(['/tabs','skin-wound',p.patientId,'assessments'],{queryParams:{roundId:this.roundId}})}
  async evaluate(p:MobileRoundPatient){this.busy=true;try{await this.rounds.markPatient(this.roundId,p.patientId,'evaluated');await this.message('Patient evaluation completed');this.selectNext()}catch(e:any){await this.message(e?.message||'Assessment required before completion','danger')}finally{this.busy=false}}
  async skip(p:MobileRoundPatient){if(!this.skipReason.trim())return;this.busy=true;try{await this.rounds.markPatient(this.roundId,p.patientId,'skipped',this.skipReason.trim());await this.message('Patient skipped with reason');this.selectNext()}catch(e:any){await this.message(e?.message||'Could not skip patient','danger')}finally{this.busy=false}}
  async completeRound(){this.busy=true;try{await this.rounds.completeRound(this.roundId);await this.message('Round completed and ready for QA')}catch(e:any){await this.message(e?.message||'Round is not ready','danger')}finally{this.busy=false}}
  back(){void this.router.navigate(['/tabs','wound-rounds'])}
  private selectNext(){const n=this.pending[0];if(n)this.selected=n}
  private async message(message:string,color?:string){const t=await this.toast.create({message,duration:2200,color});await t.present()}
}
