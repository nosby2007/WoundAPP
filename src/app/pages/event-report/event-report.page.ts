import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCheckbox,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonNote,
  IonProgressBar,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { checkmarkCircleOutline, warningOutline } from 'ionicons/icons';
import { ClinicalIdentitySnapshot, ClinicalIdentityService } from '../../services/clinical-identity.service';
import { HomeCareEventService } from '../../services/home-care-event.service';
import { Patient, PatientService } from '../../services/patient.service';
import {
  HOME_CARE_LOCATIONS,
  HomeCareEventClassDefinition,
  HomeCareEventSeverity,
  homeCareEventClass,
} from '../../shared/home-care-event';

@Component({
  selector: 'app-event-report',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonBackButton,
    IonBadge,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonCheckbox,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonNote,
    IonProgressBar,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonTextarea,
    IonTitle,
    IonToggle,
    IonToolbar,
  ],
  templateUrl: './event-report.page.html',
  styleUrls: ['./event-report.page.scss'],
})
export class EventReportPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly identityService = inject(ClinicalIdentityService);
  private readonly patientService = inject(PatientService);
  private readonly events = inject(HomeCareEventService);

  readonly checkmarkCircleOutline = checkmarkCircleOutline;
  readonly warningOutline = warningOutline;
  readonly locations = HOME_CARE_LOCATIONS;
  readonly severities: HomeCareEventSeverity[] = ['None', 'Minor', 'Moderate', 'Major', 'Death'];

  definition: HomeCareEventClassDefinition | null = null;
  identity: ClinicalIdentitySnapshot | null = null;
  patients: Patient[] = [];
  loading = true;
  saving = false;
  step = 0;
  errorMessage = '';
  confirmationId = '';
  appointmentId = '';
  woundVisitId = '';

  readonly form = this.fb.group({
    patientId: [''],
    eventDate: [this.localDate(new Date()), Validators.required],
    eventTime: [this.localTime(new Date()), Validators.required],
    locationType: ['patient_home', Validators.required],
    locationDetails: [''],
    eventType: ['', Validators.required],
    description: ['', [Validators.required, Validators.minLength(10)]],
    immediateActions: ['', [Validators.required, Validators.minLength(3)]],
    severity: ['None' as HomeCareEventSeverity, Validators.required],
    witnessed: [false],
    emergencyServicesCalled: [false],
    providerNotified: [false],
    familyNotified: [false],
    supervisorNotified: [false],
    attestation: [false, Validators.requiredTrue],
  });

  async ngOnInit(): Promise<void> {
    this.definition = homeCareEventClass(this.route.snapshot.paramMap.get('eventClass'));
    if (!this.definition) {
      await this.router.navigate(['/tabs/event-portal'], { replaceUrl: true });
      return;
    }

    const patientId = this.route.snapshot.queryParamMap.get('patientId') || '';
    this.appointmentId = this.route.snapshot.queryParamMap.get('appointmentId') || '';
    this.woundVisitId = this.route.snapshot.queryParamMap.get('woundVisitId') || '';
    if (this.definition.requiresPatient) {
      this.form.controls.patientId.addValidators(Validators.required);
      this.form.controls.patientId.updateValueAndValidity();
    }

    try {
      const [identity, patients] = await Promise.all([
        this.identityService.requireCurrentIdentity(),
        this.definition.requiresPatient ? this.patientService.listPatients() : Promise.resolve([]),
      ]);
      this.identity = identity;
      this.patients = patients;
      if (patientId && patients.some(patient => patient.id === patientId)) {
        this.form.controls.patientId.setValue(patientId);
      }
    } catch (error: any) {
      this.errorMessage = error?.message || 'The secure reporting form could not be prepared.';
    } finally {
      this.loading = false;
    }
  }

  get progress(): number { return this.confirmationId ? 1 : (this.step + 1) / 3; }
  get selectedPatient(): Patient | undefined { return this.patients.find(patient => patient.id === this.form.controls.patientId.value); }
  get selectedTypeLabel(): string { return this.definition?.options.find(option => option.value === this.form.controls.eventType.value)?.label || ''; }
  get selectedLocationLabel(): string { return this.locations.find(option => option.value === this.form.controls.locationType.value)?.label || ''; }

  next(): void {
    this.errorMessage = '';
    const controls = this.step === 0
      ? ['patientId', 'eventDate', 'eventTime', 'locationType']
      : ['eventType', 'description', 'immediateActions', 'severity'];
    controls.forEach(name => this.form.get(name)?.markAsTouched());
    if (controls.some(name => this.form.get(name)?.invalid)) {
      this.errorMessage = 'Complete the required fields before continuing.';
      return;
    }
    if (this.step === 0 && !this.occurredAt()) {
      this.errorMessage = 'Enter a valid event date and time.';
      return;
    }
    this.step = Math.min(2, this.step + 1);
    this.scrollToTop();
  }

  previous(): void {
    this.errorMessage = '';
    this.step = Math.max(0, this.step - 1);
    this.scrollToTop();
  }

  async submit(): Promise<void> {
    if (!this.definition || this.saving) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.errorMessage = 'Review the required fields and accept the attestation.';
      return;
    }
    const occurredAt = this.occurredAt();
    if (!occurredAt) {
      this.errorMessage = 'Enter a valid event date and time.';
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    try {
      const value = this.form.getRawValue();
      this.confirmationId = await this.events.create({
        eventClass: this.definition.value,
        eventType: value.eventType || '',
        patientId: value.patientId || null,
        occurredAt,
        locationType: value.locationType || '',
        locationDetails: value.locationDetails || null,
        description: value.description || '',
        immediateActions: value.immediateActions || '',
        severity: value.severity || 'None',
        witnessed: !!value.witnessed,
        emergencyServicesCalled: !!value.emergencyServicesCalled,
        providerNotified: !!value.providerNotified,
        familyNotified: !!value.familyNotified,
        supervisorNotified: !!value.supervisorNotified,
        appointmentId: this.appointmentId || null,
        woundVisitId: this.woundVisitId || null,
      });
      this.scrollToTop();
    } catch (error: any) {
      this.errorMessage = error?.message || 'The event report could not be submitted.';
    } finally {
      this.saving = false;
    }
  }

  close(): void { void this.router.navigate(['/tabs/event-portal']); }

  private occurredAt(): Date | null {
    const date = this.form.controls.eventDate.value;
    const time = this.form.controls.eventTime.value;
    if (!date || !time) return null;
    const value = new Date(`${date}T${time}:00`);
    return Number.isNaN(value.getTime()) ? null : value;
  }

  private localDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private localTime(date: Date): string {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  private scrollToTop(): void { requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' })); }
}
