import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonBadge, IonButton, IonCard, IonCardContent, IonContent, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonNote, IonSelect, IonSelectOption, IonSpinner, IonTitle, IonToolbar, ToastController } from '@ionic/angular/standalone';
import { addOutline, calendarClearOutline, callOutline, chevronForwardOutline, locationOutline, navigateOutline, sparklesOutline, timeOutline } from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { MobileScheduledVisit, MobileSchedulePatient, MobileScheduleService } from '../../services/mobile-schedule.service';

interface ScheduleDay {
  key: string;
  label: string;
  visits: MobileScheduledVisit[];
}

@Component({
  selector: 'app-my-schedule',
  standalone: true,
  imports: [CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonIcon, IonBadge, IonCard, IonCardContent, IonInput, IonItem, IonLabel, IonSelect, IonSelectOption, IonSpinner, IonNote],
  template: `
    <ion-header class="ion-no-border"><ion-toolbar><ion-title>My Schedule</ion-title></ion-toolbar></ion-header>
    <ion-content>
      <div class="page">
        <section class="hero">
          <div><p class="eyebrow">CLINICAL FLIGHT PLAN</p><h1>Prepare before you arrive.</h1><p>See your future workload, route context and next clinical touchpoints.</p></div>
          <ion-button fill="solid" color="light" (click)="plannerOpen = !plannerOpen"><ion-icon slot="start" [icon]="addOutline"></ion-icon>Plan visit</ion-button>
        </section>

        <section class="planner" *ngIf="plannerOpen">
          <div class="planner-head"><div><p class="eyebrow dark">SELF SCHEDULING</p><h2>Plan my next visit</h2></div><ion-icon [icon]="sparklesOutline"></ion-icon></div>
          <ion-item lines="none" class="field"><ion-select label="Patient" labelPlacement="stacked" [(ngModel)]="patientId" interface="popover"><ion-select-option *ngFor="let p of patients" [value]="p.id">{{ p.name }}</ion-select-option></ion-select></ion-item>
          <div class="grid">
            <ion-item lines="none" class="field"><ion-input label="Start" labelPlacement="stacked" type="datetime-local" [(ngModel)]="startIso"></ion-input></ion-item>
            <ion-item lines="none" class="field"><ion-select label="Duration" labelPlacement="stacked" [(ngModel)]="duration"><ion-select-option [value]="30">30 min</ion-select-option><ion-select-option [value]="45">45 min</ion-select-option><ion-select-option [value]="60">60 min</ion-select-option><ion-select-option [value]="90">90 min</ion-select-option><ion-select-option [value]="120">120 min</ion-select-option></ion-select></ion-item>
          </div>
          <ion-item lines="none" class="field"><ion-input label="Visit details" labelPlacement="stacked" [(ngModel)]="details" placeholder="Wound follow-up"></ion-input></ion-item>
          <div class="patient-preview" *ngIf="selectedPatient as p"><strong>{{ p.name }}</strong><span *ngIf="p.address"><ion-icon [icon]="locationOutline"></ion-icon>{{ p.address }}</span><span *ngIf="p.phone"><ion-icon [icon]="callOutline"></ion-icon>{{ p.phone }}</span><small>Contact context comes from Patient Intake and is copied into the appointment snapshot.</small></div>
          <ion-button expand="block" [disabled]="saving || !patientId || !startIso" (click)="plan()"><ion-spinner *ngIf="saving" name="crescent"></ion-spinner><span *ngIf="!saving">Add to my schedule</span></ion-button>
        </section>

        <section class="summary">
          <div><strong>{{ visits.length }}</strong><span>Next 60 days</span></div><div><strong>{{ thisWeekCount }}</strong><span>This week</span></div><div><strong>{{ facilityCount }}</strong><span>Facility visits</span></div>
        </section>

        <section class="section" *ngFor="let day of days">
          <div class="day-head"><div><p class="eyebrow dark">{{ day.key === todayKey ? 'TODAY' : 'UPCOMING' }}</p><h2>{{ day.label }}</h2></div><ion-badge>{{ day.visits.length }}</ion-badge></div>
          <ion-card class="visit" *ngFor="let visit of day.visits" button="true" (click)="openVisit(visit)">
            <ion-card-content>
              <div class="visit-grid"><div class="clock"><ion-icon [icon]="timeOutline"></ion-icon><strong>{{ schedule.toDate(visit.start) | date:'shortTime' }}</strong></div><div class="main"><span class="micro">{{ visit.visitType || visit.appointmentDetails || 'Wound visit' }}</span><h3>{{ visit.patientName }}</h3><p *ngIf="visit.homeAddress"><ion-icon [icon]="locationOutline"></ion-icon>{{ visit.homeAddress }}</p><div class="actions"><a *ngIf="visit.patientTelephone" (click)="$event.stopPropagation()" [href]="call(visit.patientTelephone)">Call</a><a *ngIf="visit.homeAddress" (click)="$event.stopPropagation()" [href]="directions(visit.homeAddress)" target="_blank" rel="noopener">Directions</a></div></div><ion-icon class="go" [icon]="chevronForwardOutline"></ion-icon></div>
            </ion-card-content>
          </ion-card>
        </section>

        <div class="empty" *ngIf="!loading && !visits.length"><ion-icon [icon]="calendarClearOutline"></ion-icon><h2>No future visits</h2><p>Plan your next clinical touchpoint or schedule one when closing a visit.</p></div>
        <div class="loading" *ngIf="loading"><ion-spinner></ion-spinner><p>Building your clinical schedule…</p></div>
        <ion-note class="note">Only visits assigned to your signed-in account are shown here.</ion-note>
      </div>
    </ion-content>
  `,
  styles: [`
    :host{--ink:#10233f;--muted:#687b8f;--green:#0a7654;--navy:#163d5d}ion-toolbar{--background:#fff;--color:var(--ink)}.page{background:#f3f7f9;min-height:100%;padding:16px 16px 44px}.hero{border-radius:30px;padding:24px;background:radial-gradient(circle at 85% 10%,rgba(255,255,255,.17),transparent 26%),linear-gradient(145deg,#0a7654,#173c5c 78%);color:white;box-shadow:0 20px 48px rgba(20,62,84,.2);display:flex;align-items:flex-end;justify-content:space-between;gap:20px}.hero h1{margin:4px 0 7px;font-size:29px}.hero p{margin:0;opacity:.78;max-width:560px}.eyebrow{font-size:10px;letter-spacing:.17em;font-weight:850;margin:0}.eyebrow.dark{color:#5f778b}.planner{background:#fff;border-radius:26px;padding:18px;margin-top:16px;box-shadow:0 8px 28px rgba(31,62,82,.08)}.planner-head{display:flex;justify-content:space-between;align-items:center}.planner-head h2{margin:3px 0 12px;color:var(--ink)}.planner-head>ion-icon{font-size:28px;color:var(--green)}.field{--background:#f7fafb;border-radius:15px;margin:8px 0}.grid{display:grid;grid-template-columns:1.2fr .8fr;gap:10px}.patient-preview{display:grid;gap:5px;background:#eef7f3;border-radius:16px;padding:13px;margin:10px 0;color:#496779}.patient-preview strong{color:var(--ink)}.patient-preview span{font-size:12px;display:flex;gap:6px;align-items:center}.patient-preview small{font-size:10px;opacity:.72}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin:18px 0}.summary div{background:#fff;border-radius:18px;padding:14px;box-shadow:0 5px 18px rgba(30,55,75,.05)}.summary strong{font-size:22px;color:var(--ink);display:block}.summary span{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}.section{margin-top:24px}.day-head{display:flex;justify-content:space-between;align-items:end;margin:0 4px 8px}.day-head h2{margin:2px 0;color:var(--ink);font-size:20px}.visit{margin:9px 0;border-radius:22px;box-shadow:0 7px 22px rgba(30,55,75,.06)}.visit-grid{display:grid;grid-template-columns:62px 1fr 22px;gap:12px}.clock{height:62px;border-radius:17px;background:#edf7f3;color:var(--green);display:grid;place-items:center;align-content:center;gap:4px}.clock strong{font-size:11px}.main h3{margin:4px 0;color:var(--ink);font-size:17px}.main p{font-size:11px;color:var(--muted);display:flex;gap:5px;margin:4px 0}.micro{font-size:9px;color:#5b7488;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.actions{display:flex;gap:14px;margin-top:8px}.actions a{font-size:11px;font-weight:750;color:#0b6e9f;text-decoration:none}.go{color:#9eafbb;margin-top:20px}.empty,.loading{text-align:center;background:#fff;border-radius:24px;padding:34px 20px;color:var(--muted)}.empty ion-icon{font-size:38px;color:var(--green)}.empty h2{color:var(--ink)}.note{display:block;text-align:center;margin-top:20px;font-size:10px}@media(max-width:640px){.hero{display:block}.hero ion-button{margin-top:18px}.grid{grid-template-columns:1fr}}
  `],
})
export class MySchedulePage implements OnInit, OnDestroy {
  readonly addOutline = addOutline; readonly calendarClearOutline = calendarClearOutline; readonly callOutline = callOutline; readonly chevronForwardOutline = chevronForwardOutline; readonly locationOutline = locationOutline; readonly navigateOutline = navigateOutline; readonly sparklesOutline = sparklesOutline; readonly timeOutline = timeOutline;
  visits: MobileScheduledVisit[] = []; days: ScheduleDay[] = []; patients: MobileSchedulePatient[] = []; loading = true; saving = false; plannerOpen = false;
  patientId = ''; startIso = ''; duration = 60; details = 'Wound follow-up';
  readonly todayKey = this.key(new Date()); private sub?: Subscription;

  constructor(public schedule: MobileScheduleService, private router: Router, private toast: ToastController) {}

  async ngOnInit(): Promise<void> {
    this.patients = await this.schedule.patients().catch(() => []);
    this.sub = this.schedule.future$().subscribe({ next: rows => { this.visits = rows.filter(v => v.status !== 'canceled'); this.days = this.group(this.visits); this.loading = false; }, error: async () => { this.loading = false; await this.message('Schedule is temporarily unavailable', 'danger'); } });
  }
  ngOnDestroy(): void { this.sub?.unsubscribe(); }
  get selectedPatient(): MobileSchedulePatient | undefined { return this.patients.find(p => p.id === this.patientId); }
  get thisWeekCount(): number { const end = new Date(); end.setDate(end.getDate()+7); return this.visits.filter(v => { const d=this.schedule.toDate(v.start); return !!d && d < end; }).length; }
  get facilityCount(): number { return this.visits.filter(v => !!v.facilityId).length; }

  async plan(): Promise<void> {
    const patient = this.selectedPatient; if (!patient || !this.startIso) return;
    this.saving = true;
    try { const id = await this.schedule.planOwnVisit(patient, new Date(this.startIso), Number(this.duration), this.details); this.plannerOpen = false; this.patientId=''; this.startIso=''; await this.message('Visit added to your schedule'); void id; }
    catch (err: any) { await this.message(err?.message || 'Could not plan visit', 'danger'); }
    finally { this.saving = false; }
  }
  openVisit(v: MobileScheduledVisit): void { void this.router.navigate(['/tabs/today/visit', v.id]); }
  call(phone: string): string { return `tel:${phone.replace(/[^+\d]/g,'')}`; }
  directions(address: string): string { return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`; }
  private group(visits: MobileScheduledVisit[]): ScheduleDay[] { const map = new Map<string, MobileScheduledVisit[]>(); for (const v of visits) { const d=this.schedule.toDate(v.start); if(!d) continue; const k=this.key(d); map.set(k,[...(map.get(k)||[]),v]); } return [...map.entries()].map(([key,rows]) => ({ key, label:new Intl.DateTimeFormat(undefined,{weekday:'long',month:'short',day:'numeric'}).format(new Date(`${key}T12:00:00`)), visits:rows })); }
  private key(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  private async message(message: string, color?: string): Promise<void> { const t=await this.toast.create({message,duration:2200,color}); await t.present(); }
}
