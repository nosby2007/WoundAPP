import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonBadge, IonButton, IonContent, IonHeader, IonIcon, IonItem, IonLabel,
  IonList, IonRefresher, IonRefresherContent, IonSearchbar, IonSpinner,
  IonTitle, IonToolbar,
} from '@ionic/angular/standalone';
import { addOutline, documentAttachOutline, personOutline } from 'ionicons/icons';
import { Patient, PatientService } from '../../services/patient.service';

@Component({
  selector: 'app-reception-patients',
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonContent,
    IonSearchbar, IonList, IonItem, IonLabel, IonIcon, IonBadge, IonButton,
    IonSpinner, IonRefresher, IonRefresherContent,
  ],
  template: `
    <ion-header class="ion-no-border"><ion-toolbar><ion-title>Patients</ion-title></ion-toolbar></ion-header>
    <ion-content>
      <div class="page">
        <section class="hero">
          <p class="eyebrow">RECEPTION / SCHEDULING</p>
          <h1>Patient intake list</h1>
          <p>Administrative demographics, payer information and patient documents. Clinical wound content stays outside this workspace.</p>
          <ion-button color="light" size="small" (click)="addPatient()"><ion-icon slot="start" [icon]="addOutline"></ion-icon>New patient</ion-button>
        </section>

        <ion-searchbar [(ngModel)]="search" placeholder="Search name, MRN, phone or payer"></ion-searchbar>

        <ion-refresher slot="fixed" (ionRefresh)="load($event)"><ion-refresher-content></ion-refresher-content></ion-refresher>
        <div class="state" *ngIf="loading"><ion-spinner></ion-spinner>Loading patients…</div>
        <div class="error" *ngIf="error">{{ error }}</div>

        <ion-list lines="none" class="list">
          <ion-item button detail="false" *ngFor="let patient of filtered" (click)="open(patient)">
            <div class="avatar"><ion-icon [icon]="personOutline"></ion-icon></div>
            <ion-label>
              <strong>{{ patient.name }}</strong>
              <p>{{ patient.mrn || 'No MRN' }} · {{ patient.phone || 'No phone' }}</p>
              <p>{{ patient.insuranceProvider || patient.payor || 'Payer not entered' }}</p>
            </ion-label>
            <ion-badge slot="end" color="success">Active</ion-badge>
          </ion-item>
        </ion-list>

        <div class="state" *ngIf="!loading && !filtered.length">No active patients found.</div>
      </div>
    </ion-content>
  `,
  styles:[`
    .page{min-height:100%;padding:16px;background:#f4f7fa}.hero{padding:22px;border-radius:24px;background:linear-gradient(145deg,#173d5c,#0b7251);color:#fff}.hero h1{margin:3px 0 6px}.hero p{margin:0 0 14px;opacity:.82;font-size:12px}.eyebrow{font-size:10px;letter-spacing:.14em;font-weight:800}.list{background:transparent}.list ion-item{--background:#fff;border-radius:17px;margin:9px 0;box-shadow:0 6px 18px rgba(30,55,75,.05)}.avatar{width:42px;height:42px;border-radius:14px;background:#eaf5f0;color:#0b7551;display:grid;place-items:center;margin-right:12px}.list strong{color:#10233f}.list p{font-size:11px;color:#667b8e;margin:3px 0}.state{text-align:center;color:#667b8e;padding:28px;display:grid;gap:8px;justify-items:center}.error{background:#fff1f2;color:#9f1239;padding:11px;border-radius:12px}
  `]
})
export class ReceptionPatientsPage {
  readonly addOutline = addOutline;
  readonly documentAttachOutline = documentAttachOutline;
  readonly personOutline = personOutline;
  patients: Patient[] = [];
  loading = false;
  error = '';
  search = '';

  constructor(private service: PatientService, private router: Router) {}

  ionViewWillEnter(): void { void this.load(); }

  async load(event?: any): Promise<void> {
    this.loading = true; this.error = '';
    try { this.patients = await this.service.listPatients(500); }
    catch (e: any) { this.error = e?.message || 'Unable to load patients.'; }
    finally { this.loading = false; event?.target?.complete?.(); }
  }

  get filtered(): Patient[] {
    const q = this.search.trim().toLowerCase();
    if (!q) return this.patients;
    return this.patients.filter(p => [p.name,p.mrn,p.phone,p.insuranceProvider,p.payor].some(v => String(v||'').toLowerCase().includes(q)));
  }

  open(patient: Patient): void { void this.router.navigate(['/tabs/intake-patient', patient.id]); }
  addPatient(): void { void this.router.navigate(['/tabs/add-patient']); }
}
