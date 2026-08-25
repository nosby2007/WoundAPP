import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import {
  bodyOutline,
  calendarOutline,
  callOutline,
  clipboardOutline,
  personOutline,
} from 'ionicons/icons';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { getAuth } from 'firebase/auth';

import { ApiService } from '../../services/api.service';

/**
 * Field intake: register a new patient without leaving the app, then go
 * straight into that patient's wound assessments so the nurse can capture
 * the first photo on the spot. Posts to the same POST /patients endpoint
 * (apiV2 Cloud Function) the web app's PatientApiService.create() uses,
 * with the same payload shape -- a patient created here is indistinguishable
 * from one created in the main app.
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
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
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

  form = this.fb.group({
    name: ['', Validators.required],
    dob: [''],
    gender: [''],
    phone: [''],
    reasonForAdmission: [''],
  });

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private router: Router
  ) {
    addIcons({
      bodyOutline,
      calendarOutline,
      callOutline,
      clipboardOutline,
      personOutline,
    });
  }

  async submit(): Promise<void> {
    if (this.form.invalid) return;
    this.saving = true;
    this.errorMsg = '';

    try {
      const { orgId, facilityId } = await this.getTenantContext();
      const v = this.form.getRawValue();

      const payload: Record<string, unknown> = {
        name: v.name,
        gender: v.gender || undefined,
        phone: v.phone || undefined,
        reasonForAdmission: v.reasonForAdmission || undefined,
        dob: v.dob ? new Date(v.dob).toISOString() : undefined,
        orgId: orgId ?? undefined,
        facilityId: facilityId ?? undefined,
      };
      Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);

      const result = await firstValueFrom(this.api.createPatient(payload));
      this.router.navigate(['/tabs', 'skin-wound', result.id, 'assessments'], { replaceUrl: true });
    } catch (err: any) {
      console.error('[AddPatientPage] create failed', err);
      this.errorMsg = err?.error?.message || err?.message || 'Unable to create patient';
    } finally {
      this.saving = false;
    }
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
