import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

/**
 * Field intake: register a new patient without leaving the app, then go
 * straight into that patient's wound assessments so the nurse can capture
 * the first photo on the spot. Posts to the same POST /patients endpoint
 * (apiV2 Cloud Function) the web app's PatientApiService.create() uses,
 * with the same payload shape -- a patient created here is indistinguishable
 * from one created in the main app.
 */
@Component({
  selector: 'app-add-patient',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IonicModule],
  templateUrl: './add-patient.page.html',
  styleUrls: ['./add-patient.page.scss'],
})
export class AddPatientPage {
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
    private auth: AuthService,
    private router: Router
  ) {}

  async submit(): Promise<void> {
    if (this.form.invalid) return;
    this.saving = true;
    this.errorMsg = '';

    try {
      const { orgId, facilityId } = await this.auth.getTenantContext();
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
}
