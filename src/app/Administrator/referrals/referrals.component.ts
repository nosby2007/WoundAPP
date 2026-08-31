import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ReferralRecord, ReferralStatus } from '../../referral.model';
import { ReferralService } from '../../SERVICE/referral.service';

@Component({
  selector: 'app-referrals',
  templateUrl: './referrals.component.html',
  styleUrls: ['./referrals.component.scss'],
})
export class ReferralsComponent implements OnInit {
  form!: FormGroup;
  referrals: ReferralRecord[] = [];
  filtered: ReferralRecord[] = [];
  showForm = false;
  saving = false;
  message = '';
  fromDate = '';
  toDate = '';
  statusFilter = '';
  sourceFilter = '';

  readonly statuses: ReferralStatus[] = [
    'Received', 'Under Review', 'Insurance Verification', 'Contact/Scheduling',
    'Accepted/Scheduled', 'Admitted', 'Declined', 'Unable to Contact',
    'Insurance/Network Issue', 'Outside Service Area', 'Duplicate',
    'Hospitalized', 'Other / Not Admitted',
  ];

  readonly sources = ['Hospital', 'PCP', 'SNF', 'Home Health', 'Family', 'Self', 'Other'];

  constructor(private fb: FormBuilder, private referralsService: ReferralService) {}

  ngOnInit(): void {
    this.resetForm();
    this.referralsService.referrals$.subscribe((items) => {
      this.referrals = [...items].sort((a, b) => (b.receivedAt || '').localeCompare(a.receivedAt || ''));
      this.applyFilters();
    });
  }

  resetForm(): void {
    this.form = this.fb.group({
      receivedAt: [new Date().toISOString().slice(0, 10), Validators.required],
      referralSource: ['Hospital', Validators.required],
      referringFacility: [''],
      referringProvider: [''],
      receivedMethod: ['Fax', Validators.required],
      requestedService: ['Wound Care', Validators.required],
      primaryPayer: [''],
      secondaryPayer: [''],
      medicarePartA: [false],
      medicarePartB: [false],
      eligibilityStatus: ['Not Checked', Validators.required],
      status: ['Received', Validators.required],
      dispositionReason: [''],
      dispositionReportedBy: [''],
      assignedTo: [''],
      firstVisitDate: [''],
      admitted: [false],
      servicesRendered: [false],
      billingAmount: [0],
      notes: [''],
    });
  }

  async save(): Promise<void> {
    if (this.form.invalid || this.saving) return;
    this.saving = true;
    this.message = '';
    try {
      await this.referralsService.addReferral(this.form.value as ReferralRecord);
      this.message = 'Referral saved.';
      this.showForm = false;
      this.resetForm();
    } catch (error: any) {
      this.message = error?.message || 'Unable to save referral.';
    } finally {
      this.saving = false;
    }
  }

  applyFilters(): void {
    this.filtered = this.referrals.filter((r) => {
      const date = r.receivedAt || '';
      if (this.fromDate && date < this.fromDate) return false;
      if (this.toDate && date > this.toDate) return false;
      if (this.statusFilter && r.status !== this.statusFilter) return false;
      if (this.sourceFilter && r.referralSource !== this.sourceFilter) return false;
      return true;
    });
  }

  clearFilters(): void {
    this.fromDate = '';
    this.toDate = '';
    this.statusFilter = '';
    this.sourceFilter = '';
    this.applyFilters();
  }

  printSurveyReport(): void {
    window.print();
  }

  get admittedCount(): number { return this.filtered.filter((r) => r.admitted).length; }
  get declinedCount(): number { return this.filtered.filter((r) => r.status === 'Declined').length; }
  get pendingCount(): number { return this.filtered.filter((r) => !r.admitted && !['Declined', 'Unable to Contact', 'Outside Service Area', 'Duplicate', 'Other / Not Admitted'].includes(r.status)).length; }
  get notAdmittedCount(): number { return this.filtered.filter((r) => !r.admitted).length; }
}
