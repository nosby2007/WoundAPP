import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonBadge, IonButton, IonCard, IonCardContent, IonContent, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonNote, IonSelect, IonSelectOption, IonSpinner, IonTitle, IonToolbar, ToastController } from '@ionic/angular/standalone';
import { addCircleOutline, businessOutline, calendarOutline, chevronForwardOutline, pulseOutline, shieldCheckmarkOutline, sparklesOutline } from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { MobileFacility, MobileWoundRound, WoundRoundMobileService } from '../../services/wound-round.service';

@Component({
  selector: 'app-wound-rounds',
  standalone: true,
  imports: [CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonIcon, IonBadge, IonCard, IonCardContent, IonItem, IonLabel, IonSelect, IonSelectOption, IonInput, IonSpinner, IonNote],
  template: `
    <ion-header class="ion-no-border"><ion-toolbar><ion-title>Wound Rounds</ion-title></ion-toolbar></ion-header>
    <ion-content>
      <div class="page">
        <section class="hero">
          <div><p class="eyebrow">FACILITY COMMAND</p><h1>One building. One round. Every wound in view.</h1><p>Designed for provider rounds on iPad, with the same shared clinical record used by JADE-SHOP.</p></div>
          <div class="pulse"><ion-icon [icon]="pulseOutline"></ion-icon><span>Live clinical workspace</span></div>
        </section>

        <section class="metrics">
          <div><strong>{{ activeCount }}</strong><span>Active rounds</span></div><div><strong>{{ scheduledCount }}</strong><span>Scheduled</span></div><div><strong>{{ duePatients }}</strong><span>Patients due</span></div><div><strong>{{ completionRate }}%</strong><span>Completion</span></div>
        </section>

        <section class="launch" *ngIf="canAuthor">
          <div class="launch-head"><div><p class="eyebrow dark">ROUND MODE</p><h2>Start a facility round</h2><p>Roster is built at the moment the round starts so admissions and discharges stay current.</p></div><ion-icon [icon]="sparklesOutline"></ion-icon></div>
          <div class="launch-grid">
            <ion-item lines="none"><ion-select label="Facility" labelPlacement="stacked" [(ngModel)]="facilityId" interface="popover"><ion-select-option *ngFor="let f of facilities" [value]="f.id">{{ f.name }}</ion-select-option></ion-select></ion-item>
            <ion-item lines="none"><ion-input label="Round date" labelPlacement="stacked" type="date" [(ngModel)]="roundDate"></ion-input></ion-item>
            <ion-button [disabled]="busy || !facilityId || !roundDate" (click)="startRound()"><ion-spinner *ngIf="busy" name="crescent"></ion-spinner><ng-container *ngIf="!busy"><ion-icon slot="start" [icon]="addCircleOutline"></ion-icon>Start round</ng-container></ion-button>
          </div>
        </section>

        <section class="readonly" *ngIf="!canAuthor"><ion-icon [icon]="shieldCheckmarkOutline"></ion-icon><div><strong>Facility review mode</strong><p>Your role can review permitted wound rounds but cannot start or modify PHWC clinical operations.</p></div></section>

        <section class="section" *ngIf="inProgress.length">
          <div class="section-head"><div><p class="eyebrow dark">IN PROGRESS</p><h2>Continue where you left off</h2></div><ion-badge color="success">{{ inProgress.length }}</ion-badge></div>
          <ion-card class="round hero-round" *ngFor="let round of inProgress" button="true" (click)="open(round)"><ion-card-content><div class="round-grid"><div class="facility-icon"><ion-icon [icon]="businessOutline"></ion-icon></div><div><span class="micro">{{ round.roundDate }}</span><h3>{{ round.facilityName }}</h3><p>{{ progress(round).done }} of {{ progress(round).total }} resolved · {{ progress(round).percent }}%</p><div class="bar"><span [style.width.%]="progress(round).percent"></span></div></div><ion-icon [icon]="chevronForwardOutline"></ion-icon></div></ion-card-content></ion-card>
        </section>

        <section class="section" *ngIf="scheduled.length">
          <div class="section-head"><div><p class="eyebrow dark">UPCOMING</p><h2>Scheduled rounds</h2></div><ion-badge>{{ scheduled.length }}</ion-badge></div>
          <ion-card class="round" *ngFor="let round of scheduled"><ion-card-content><div class="round-grid"><div class="facility-icon soft"><ion-icon [icon]="calendarOutline"></ion-icon></div><div><span class="micro">{{ round.roundDate }}</span><h3>{{ round.facilityName }}</h3><p>Roster will be generated when the round begins.</p></div><ion-button *ngIf="canAuthor" fill="outline" size="small" [disabled]="busy" (click)="$event.stopPropagation(); startScheduled(round)">Start</ion-button><ion-icon *ngIf="!canAuthor" [icon]="chevronForwardOutline" (click)="open(round)"></ion-icon></div></ion-card-content></ion-card>
        </section>

        <section class="section" *ngIf="recent.length">
          <div class="section-head"><div><p class="eyebrow dark">RECENT</p><h2>Completed rounds</h2></div></div>
          <ion-card class="round compact" *ngFor="let round of recent" button="true" (click)="open(round)"><ion-card-content><div class="round-grid"><div class="facility-icon done"><ion-icon [icon]="shieldCheckmarkOutline"></ion-icon></div><div><span class="micro">{{ round.roundDate }}</span><h3>{{ round.facilityName }}</h3><p>{{ progress(round).total }} patients · QA {{ round.qaStatus || 'not ready' }}</p></div><ion-icon [icon]="chevronForwardOutline"></ion-icon></div></ion-card-content></ion-card>
        </section>

        <div class="empty" *ngIf="!loading && !rounds.length"><ion-icon [icon]="businessOutline"></ion-icon><h2>No wound rounds yet</h2><p>Start the first facility round when the provider arrives on site.</p></div>
        <div class="loading" *ngIf="loading"><ion-spinner></ion-spinner><p>Loading facility rounds…</p></div>
        <ion-note class="foot">Wound Round data stays in the shared woundRounds collection; this mobile workspace does not create a parallel chart.</ion-note>
      </div>
    </ion-content>
  `,
  styles: [`
    :host{--ink:#10233f;--muted:#687b8f;--green:#087455;--navy:#173d5d}ion-toolbar{--background:#fff;--color:var(--ink)}.page{background:#f3f7f9;min-height:100%;padding:16px 16px 44px}.hero{background:radial-gradient(circle at 92% 8%,rgba(255,255,255,.19),transparent 24%),linear-gradient(145deg,#0a7654,#163b5c 80%);color:#fff;border-radius:30px;padding:25px;display:flex;justify-content:space-between;align-items:end;gap:22px;box-shadow:0 20px 48px rgba(20,62,84,.2)}.hero h1{font-size:30px;margin:5px 0 8px;max-width:760px}.hero p{margin:0;opacity:.78}.eyebrow{font-size:10px;letter-spacing:.17em;font-weight:850;margin:0}.eyebrow.dark{color:#5b7489}.pulse{display:flex;gap:8px;align-items:center;background:rgba(255,255,255,.11);padding:9px 12px;border-radius:999px;font-size:11px;white-space:nowrap}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0}.metrics div{background:#fff;border-radius:20px;padding:16px;box-shadow:0 5px 18px rgba(30,55,75,.05)}.metrics strong{display:block;color:var(--ink);font-size:24px}.metrics span{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}.launch{background:#fff;border-radius:26px;padding:18px;margin:16px 0;box-shadow:0 8px 28px rgba(31,62,82,.07)}.launch-head{display:flex;justify-content:space-between;align-items:start}.launch-head h2{margin:3px 0;color:var(--ink)}.launch-head p{margin:0;color:var(--muted);font-size:12px}.launch-head>ion-icon{font-size:28px;color:var(--green)}.launch-grid{display:grid;grid-template-columns:1.5fr 1fr auto;gap:10px;margin-top:14px;align-items:end}.launch ion-item{--background:#f7fafb;border-radius:15px}.readonly{display:flex;gap:12px;align-items:center;background:#fff7e6;color:#75571d;border-radius:20px;padding:15px;margin:16px 0}.readonly ion-icon{font-size:26px}.readonly p{margin:2px 0;font-size:11px}.section{margin-top:25px}.section-head{display:flex;justify-content:space-between;align-items:end;margin:0 4px 9px}.section-head h2{margin:3px 0;color:var(--ink);font-size:20px}.round{border-radius:22px;margin:9px 0;box-shadow:0 7px 22px rgba(30,55,75,.06)}.hero-round{border:1px solid #d9eee5}.round-grid{display:grid;grid-template-columns:54px 1fr auto;gap:12px;align-items:center}.facility-icon{width:54px;height:54px;border-radius:18px;background:#e9f7f1;color:var(--green);display:grid;place-items:center}.facility-icon.soft{background:#edf4fa;color:#315f85}.facility-icon.done{background:#eef7f3}.facility-icon ion-icon{font-size:25px}.round h3{margin:3px 0;color:var(--ink);font-size:17px}.round p{margin:0;color:var(--muted);font-size:11px}.micro{font-size:9px;letter-spacing:.11em;font-weight:800;color:#5e778b}.bar{height:5px;background:#e8eef2;border-radius:999px;overflow:hidden;margin-top:9px}.bar span{display:block;height:100%;background:var(--green)}.empty,.loading{text-align:center;background:#fff;border-radius:24px;padding:34px 20px;color:var(--muted)}.empty ion-icon{font-size:38px;color:var(--green)}.empty h2{color:var(--ink)}.foot{display:block;text-align:center;margin-top:22px;font-size:10px}@media(max-width:720px){.hero{display:block}.pulse{margin-top:16px;width:max-content}.metrics{grid-template-columns:repeat(2,1fr)}.launch-grid{grid-template-columns:1fr}}
  `],
})
export class WoundRoundsPage implements OnInit, OnDestroy {
  readonly addCircleOutline=addCircleOutline; readonly businessOutline=businessOutline; readonly calendarOutline=calendarOutline; readonly chevronForwardOutline=chevronForwardOutline; readonly pulseOutline=pulseOutline; readonly shieldCheckmarkOutline=shieldCheckmarkOutline; readonly sparklesOutline=sparklesOutline;
  facilities: MobileFacility[]=[]; rounds: MobileWoundRound[]=[]; loading=true; busy=false; canAuthor=false; facilityId=''; roundDate=this.today(); private subs=new Subscription();
  constructor(private roundsService:WoundRoundMobileService,private router:Router,private toast:ToastController){}
  async ngOnInit():Promise<void>{this.canAuthor=await this.roundsService.canAuthor().catch(()=>false);this.subs.add(this.roundsService.facilities$().subscribe({next:v=>this.facilities=v,error:()=>{}}));this.subs.add(this.roundsService.rounds$().subscribe({next:v=>{this.rounds=v;this.loading=false},error:async()=>{this.loading=false;await this.message('Wound rounds are temporarily unavailable','danger')}}));}
  ngOnDestroy():void{this.subs.unsubscribe()}
  get inProgress(){return this.rounds.filter(r=>r.status==='in_progress')}
  get scheduled(){return this.rounds.filter(r=>r.status==='scheduled').sort((a,b)=>a.roundDate.localeCompare(b.roundDate))}
  get recent(){return this.rounds.filter(r=>r.status==='completed').slice(0,12)}
  get activeCount(){return this.inProgress.length} get scheduledCount(){return this.scheduled.length}
  get duePatients(){return this.inProgress.flatMap(r=>r.patients||[]).filter(p=>p.status==='pending'||p.status==='in_progress').length}
  get completionRate(){const p=this.inProgress.flatMap(r=>r.patients||[]);if(!p.length)return 0;return Math.round(p.filter(x=>['evaluated','seen','skipped'].includes(x.status)).length/p.length*100)}
  progress(r:MobileWoundRound){const total=(r.patients||[]).length;const done=(r.patients||[]).filter(p=>['evaluated','seen','skipped'].includes(p.status)).length;return{total,done,percent:total?Math.round(done/total*100):0}}
  async startRound(){const facility=this.facilities.find(f=>f.id===this.facilityId);if(!facility)return;this.busy=true;try{const id=await this.roundsService.startRound(facility,this.roundDate);void this.router.navigate(['/tabs/wound-rounds',id])}catch(e:any){await this.message(e?.message||'Could not start round','danger')}finally{this.busy=false}}
  async startScheduled(round:MobileWoundRound){this.busy=true;try{await this.roundsService.startScheduled(round.id);void this.router.navigate(['/tabs/wound-rounds',round.id])}catch(e:any){await this.message(e?.message||'Could not start round','danger')}finally{this.busy=false}}
  open(round:MobileWoundRound){void this.router.navigate(['/tabs/wound-rounds',round.id])}
  private today(){const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
  private async message(message:string,color?:string){const t=await this.toast.create({message,duration:2200,color});await t.present()}
}
