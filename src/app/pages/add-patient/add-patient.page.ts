import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonAccordion,
  IonAccordionGroup,
  IonBackButton,
  IonButton,
  IonButtons,
  IonCheckbox,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import {
  addCircleOutline,
  bodyOutline,
  calendarOutline,
  callOutline,
  clipboardOutline,
  closeCircle,
  documentTextOutline,
  homeOutline,
  medkitOutline,
  personOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { getAuth } from 'firebase/auth';

import { ApiService } from '../../services/api.service';
import {
  buildPatientIntakePayload,
  intakeGaps,
  PatientIntakeFormValue,
} from '../../shared/patient-intake';

/**
 * Field intake: the whole registration, done in the home.
 *
 * The nurse arrives, registers the patient, assesses the wounds and leaves.
 * That is only true if the record created here is the record -- if it holds
 * five fields, somebody re-keys the rest from a paper form later, and the
 * visit did not actually save the trip.
 *
 * So this asks what the web app's own intake asks
 * (patients/pages/patient-form), grouped into sections that fit a phone and
 * collapsed by default: only the name is required, and every section can be
 * left alone. The address is its own section because it is the field with
 * two downstream users -- the claim's service address, and the point a home
 * visit's EVV check-in is measured against.
 *
 * NOTHING IS REQUIRED BUT THE NAME.
 * The web form makes date of birth, admission date and all three consent
 * acknowledgements mandatory. That is right for a desk with the paperwork in
 * front of it and wrong for a doorway: a nurse who cannot produce a consent
 * signature right now would either abandon the intake or tick the box
 * falsely, and the second is worse than an incomplete record. What is missing
 * is shown on the way out instead (`intakeGaps`), as a reminder, never as a
 * block.
 *
 * Reads the current user via getAuth().currentUser (same pattern as
 * AssessmentFormPage.save()) rather than the injected Auth token, and
 * injects Firestore directly here rather than through AuthService --
 * combining Auth + Firestore injection in that shared, root-provided
 * service triggered an NG0200 (circular DI) when this app's mixed
 * compat/modular Firebase setup tried to construct it. Keeping both
 * dependencies scoped to this one component avoids that entirely.
 */
@Component({
  selector: 'app-add-patient',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule,
    // Ionic standalone resolves ion-* through these component classes.
    // IonicModule (the NgModule API) sat here instead, which registers
    // nothing for a standalone component: the tags fell through as
    // unknown elements and the page rendered as bare HTML.
    IonAccordion,
    IonAccordionGroup,
    IonBackButton,
    IonButton,
    IonButtons,
    IonCheckbox,
    IonChip,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonNote,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './add-patient.page.html',
  styleUrls: ['./add-patient.page.scss'],
})
export class AddPatientPage {
  private firestore = inject(Firestore);

  saving = false;
  errorMsg = '';

  /** Free-text lists, edited as chips rather than typed as one blob. */
  allergies: string[] = [];
  diagnoses: string[] = [];

  form = this.fb.group({
    // Who the patient is.
    name: ['', Validators.required],
    preferredName: [''],
    dob: [''],
    gender: [''],
    phone: [''],
    email: [''],

    // Where they are. The EVV check-in and the claim both need this.
    address1: [''],
    address2: [''],
    city: [''],
    state: [''],
    zip: [''],
    country: [''],
    roomNumber: [''],
    unit: [''],
    language: [''],
    maritalStatus: [''],

    // Who pays, and who to call.
    insuranceProvider: [''],
    insuranceId: [''],
    groupNumber: [''],
    payor: [''],
    policyHolder: [''],
    idType: [''],
    idNumber: [''],
    ssn: [''],
    emergencyContactName: [''],
    emergencyContactPhone: [''],
    emergencyRelation: [''],

    // Why we are here.
    reasonForAdmission: [''],
    admissionDate: [''],
    primaryCareProvider: [''],
    referringProvider: [''],
    codeStatus: [''],
    preferredPharmacy: [''],
    heightCm: [''],
    weightKg: [''],

    // What was actually acknowledged, which may be nothing.
    hipaaAck: [false],
    privacyNoticeAck: [false],
    financialAgreementAck: [false],
  });

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private router: Router
  ) {
    addIcons({
      addCircleOutline,
      bodyOutline,
      calendarOutline,
      callOutline,
      clipboardOutline,
      closeCircle,
      documentTextOutline,
      homeOutline,
      medkitOutline,
      personOutline,
      shieldCheckmarkOutline,
    });
  }

  /** What is still missing, for the reminder under the save button. */
  get gaps(): string[] {
    return intakeGaps(this.currentValue());
  }

  addAllergy(input: { value?: string | number | null }): void {
    this.pushChip(this.allergies, input?.value);
  }

  removeAllergy(index: number): void {
    this.allergies.splice(index, 1);
  }

  addDiagnosis(input: { value?: string | number | null }): void {
    this.pushChip(this.diagnoses, input?.value);
  }

  removeDiagnosis(index: number): void {
    this.diagnoses.splice(index, 1);
  }

  private pushChip(target: string[], raw: unknown): void {
    const value = (raw ?? '').toString().trim();
    if (!value) return;
    // Case-insensitive, so "Sulfa" and "sulfa" do not both end up in the
    // allergy list, where a duplicate reads as two separate reports.
    if (target.some((entry) => entry.toLowerCase() === value.toLowerCase())) return;
    target.push(value);
  }

  private currentValue(): PatientIntakeFormValue {
    const v = this.form.getRawValue();
    return {
      legalName: v.name ?? '',
      preferredName: v.preferredName,
      gender: v.gender,
      dob: v.dob,
      admissionDate: v.admissionDate,
      phone: v.phone,
      email: v.email,
      address1: v.address1,
      address2: v.address2,
      city: v.city,
      state: v.state,
      zip: v.zip,
      country: v.country,
      language: v.language,
      maritalStatus: v.maritalStatus,
      roomNumber: v.roomNumber,
      unit: v.unit,
      ssn: v.ssn,
      idType: v.idType,
      idNumber: v.idNumber,
      insuranceProvider: v.insuranceProvider,
      insuranceId: v.insuranceId,
      groupNumber: v.groupNumber,
      payor: v.payor,
      policyHolder: v.policyHolder,
      emergencyContactName: v.emergencyContactName,
      emergencyContactPhone: v.emergencyContactPhone,
      emergencyRelation: v.emergencyRelation,
      reasonForAdmission: v.reasonForAdmission,
      primaryCareProvider: v.primaryCareProvider,
      referringProvider: v.referringProvider,
      codeStatus: v.codeStatus,
      preferredPharmacy: v.preferredPharmacy,
      heightCm: v.heightCm,
      weightKg: v.weightKg,
      allergies: this.allergies,
      diagnoses: this.diagnoses,
      hipaaAck: v.hipaaAck,
      privacyNoticeAck: v.privacyNoticeAck,
      financialAgreementAck: v.financialAgreementAck,
    };
  }

  async submit(): Promise<void> {
    if (this.form.invalid) return;
    this.saving = true;
    this.errorMsg = '';

    try {
      const { orgId, facilityId } = await this.getTenantContext();
      const payload = buildPatientIntakePayload(this.currentValue(), { orgId, facilityId });

      const result = await firstValueFrom(this.api.createPatient(payload));
      this.router.navigate(['/tabs', 'skin-wound', result.id, 'assessments'], { replaceUrl: true });
    } catch (err: any) {
      console.error('[AddPatientPage] create failed', err);
      this.errorMsg = this.describeError(err);
    } finally {
      this.saving = false;
    }
  }

  /**
   * Status 0 is not an HTTP error -- it means no response arrived at all, so
   * there is no body to read a message from and "Unable to create patient"
   * sends the nurse looking in the wrong place. Naming it as a connection
   * failure is the difference between retrying from the car park and
   * reporting a bug.
   */
  private describeError(err: any): string {
    if (err?.status === 0) {
      return 'Could not reach the server. Check the signal and try again.';
    }
    return err?.error?.message || err?.message || 'Unable to create patient';
  }

  /**
   * Resolves the signed-in nurse's org/facility for stamping the new
   * patient. Reads users/{uid}, same field-name fallbacks (orgId/orgID/
   * tenantId/tenantID, facilityId/facilityID/primaryFacilityId) as the web
   * app's TenantContextService, so a patient created here is
   * indistinguishable from one created in the main app.
   */
  private async getTenantContext(): Promise<{ orgId: string | null; facilityId: string | null }> {
    const uid = getAuth().currentUser?.uid;
    if (!uid) return { orgId: null, facilityId: null };

    const snap = await getDoc(doc(this.firestore, `users/${uid}`));
    const data = (snap.data() as Record<string, unknown>) ?? {};

    const orgId =
      this.readString(data, 'orgId') ??
      this.readString(data, 'orgID') ??
      this.readString(data, 'tenantId') ??
      this.readString(data, 'tenantID');

    const facilityId =
      this.readString(data, 'facilityId') ??
      this.readString(data, 'facilityID') ??
      this.readString(data, 'primaryFacilityId');

    return { orgId, facilityId };
  }

  private readString(source: Record<string, unknown>, key: string): string | null {
    const value = source[key];
    return typeof value === 'string' && value.trim() ? value : null;
  }
}
