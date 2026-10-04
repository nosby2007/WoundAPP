import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonSelect, IonSelectOption,
  IonTextarea, IonItem, IonLabel, IonSpinner } from '@ionic/angular/standalone';
import { Patient, PatientService } from '../../services/patient.service';
import { TelehealthService } from '../../services/telehealth.service';

@Component({
  standalone: true,
  selector: 'app-field-telehealth',
  imports: [CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonButton,
    IonSelect, IonSelectOption, IonTextarea, IonItem, IonLabel, IonSpinner],
  template: `
    <ion-header><ion-toolbar><ion-title>New Telehealth</ion-title></ion-toolbar></ion-header>
    <ion-content><main>
      <h1>Call the NP from the patient's side</h1>
      <p>Use an existing patient and documented wound. The assigned NP opens the same consultation in JADE.</p>
      <p role="alert" *ngIf="error">{{ error }}</p><ion-spinner *ngIf="busy"></ion-spinner>
      <ion-item><ion-label>Patient</ion-label><ion-select [(ngModel)]="patientId" (ionChange)="loadWounds()" [disabled]="busy">
        <ion-select-option *ngFor="let p of patients" [value]="p.id">{{ p.name }}</ion-select-option>
      </ion-select></ion-item>
      <ion-item><ion-label>Wound</ion-label><ion-select [(ngModel)]="woundId" [disabled]="busy">
        <ion-select-option *ngFor="let w of wounds" [value]="w.id">{{ w.label }}</ion-select-option>
      </ion-select></ion-item>
      <p *ngIf="patientId && !busy && !wounds.length">No persisted wound available. Complete the wound record first.</p>
      <ion-item><ion-label>NP / Provider</ion-label><ion-select [(ngModel)]="providerUid" [disabled]="busy">
        <ion-select-option *ngFor="let p of providers" [value]="p.uid">{{ p.name }}</ion-select-option>
      </ion-select></ion-item>
      <p *ngIf="!busy && !providers.length">No eligible provider is available in your organization.</p>
      <ion-textarea label="Reason for consultation" labelPlacement="stacked" [(ngModel)]="reason" maxlength="500" [disabled]="busy"></ion-textarea>
      <ion-button expand="block" [disabled]="busy || !patientId || !woundId || !providerUid || reason.trim().length < 5" (click)="create()">Create consultation</ion-button>
      <p>This creates a linked consultation, not a physical EVV check-in, procedure or billable claim.</p>
    </main></ion-content>`,
  styles: [`main{max-width:700px;margin:auto;padding:20px}p[role=alert]{color:var(--ion-color-danger)}ion-textarea{margin:18px 0}`],
})
export class TelehealthPage implements OnInit {
  patients: Patient[] = []; providers: {uid: string; name: string}[] = [];
  wounds: {id: string; label: string}[] = [];
  patientId = ''; woundId = ''; providerUid = ''; reason = ''; busy = false; error = '';
  constructor(private patientService: PatientService, private service: TelehealthService,
    private route: ActivatedRoute, private router: Router) {}
  async ngOnInit(): Promise<void> {
    this.busy = true;
    try {
      [this.patients, this.providers] = await Promise.all([this.patientService.listPatients(), this.service.providers()]);
      const patientId = this.route.snapshot.queryParamMap.get('patientId') || '';
      if (this.patients.some(p => p.id === patientId)) {
        this.patientId = patientId;
        await this.loadWounds();
        const woundId = this.route.snapshot.queryParamMap.get('woundId') || '';
        if (this.wounds.some(w => w.id === woundId)) this.woundId = woundId;
      }
    } catch (e: any) { this.error = e?.message || 'Unable to load consultation context.'; }
    finally { this.busy = false; }
  }
  async loadWounds(): Promise<void> {
    this.woundId = ''; this.wounds = []; this.error = ''; this.busy = true;
    try { if (this.patientId) this.wounds = await this.service.wounds(this.patientId); }
    catch (e: any) { this.error = e?.message || 'Unable to load wounds.'; }
    finally { this.busy = false; }
  }
  async create(): Promise<void> {
    if (this.busy || !this.patientId || !this.woundId || !this.providerUid || this.reason.trim().length < 5) return;
    this.busy = true; this.error = '';
    try {
      const result = await this.service.create({patientId: this.patientId, woundId: this.woundId,
        providerUid: this.providerUid, reason: this.reason.trim()});
      await this.router.navigate(['/tabs/telehealth/session', result.appointmentId]);
    } catch (e: any) { this.error = e?.message || 'Consultation creation failed.'; }
    finally { this.busy = false; }
  }
}
