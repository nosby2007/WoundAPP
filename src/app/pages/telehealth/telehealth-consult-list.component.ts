import {CommonModule} from '@angular/common';
import {Component, Input, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {FieldTelehealthAppointment, TelehealthService} from '../../services/telehealth.service';

export function canResumeFieldConsult(item: FieldTelehealthAppointment): boolean {
  return !['ended', 'cancelled', 'failed'].includes(item.sessionState) &&
    !['cancelled', 'canceled', 'completed', 'no_show'].includes(item.status);
}

@Component({
  standalone: true, selector: 'app-telehealth-consult-list', imports: [CommonModule],
  template: `
    <section aria-labelledby="consult-list-title">
      <header><div><p class="eyebrow">FIELD TELEHEALTH</p><h2 id="consult-list-title">My consultations</h2></div>
        <button type="button" (click)="refresh()" [disabled]="loading">Refresh</button></header>
      <p>Resume your existing request when the NP is available. Pending requests from previous days remain accessible.</p>
      <p role="status" *ngIf="loading">Loading consultations…</p>
      <p role="alert" *ngIf="error">{{ error }}</p>
      <article *ngFor="let item of visibleAppointments">
        <h3>{{ item.patientName }}</h3><p>{{ item.woundLabel }} · {{ item.providerName }}</p>
        <p>{{ item.startIso | date:'medium' }} · {{ item.sessionState }} · {{ item.status }}</p>
        <p>{{ item.reason }}</p>
        <button type="button" (click)="resume(item)" [disabled]="!canResume(item)">Resume consultation</button>
      </article>
      <p *ngIf="!loading && !error && !visibleAppointments.length">{{ openOnly ? 'No open consultations on this page.' : 'No consultations found.' }}</p>
      <button type="button" *ngIf="nextCursor" (click)="refresh(true)" [disabled]="loading">Load more consultations</button>
    </section>`,
  styles: [`section{margin:22px 0;padding:18px;background:white;border:1px solid #dbe6df;border-radius:20px;color:#17352a}header{display:flex;align-items:center;justify-content:space-between;gap:12px}h2,h3{margin:4px 0}.eyebrow{font-size:10px;letter-spacing:.1em;font-weight:800;color:#23784b}article{border-top:1px solid #dbe6df;padding:16px 0}p{line-height:1.5;font-size:14px}button{min-height:44px;padding:10px 16px;border:0;border-radius:10px;background:#23784b;color:white;font-weight:700}button:disabled{opacity:.5}p[role=alert]{color:#a52532}`],
})
export class TelehealthConsultListComponent implements OnInit {
  @Input() openOnly = false;
  appointments: FieldTelehealthAppointment[] = [];
  nextCursor: string | null = null;
  loading = false;
  error = '';
  readonly canResume = canResumeFieldConsult;
  get visibleAppointments() { return this.openOnly ? this.appointments.filter(canResumeFieldConsult) : this.appointments; }
  constructor(private service: TelehealthService, private router: Router) {}
  ngOnInit(): void { void this.refresh(); }
  async refresh(more = false): Promise<void> {
    if (this.loading) return;
    this.loading = true; this.error = '';
    if (!more) { this.appointments = []; this.nextCursor = null; }
    try {
      const result = await this.service.listFacilitatorAppointments(more ? this.nextCursor || undefined : undefined);
      this.appointments = [...this.appointments, ...result.appointments]
        .sort((a, b) => (b.startIso || '').localeCompare(a.startIso || ''));
      this.nextCursor = result.nextCursor;
    } catch (e: any) { this.error = e?.message || 'Unable to load consultations. Refresh to retry.'; }
    finally { this.loading = false; }
  }
  async resume(item: FieldTelehealthAppointment): Promise<void> {
    if (canResumeFieldConsult(item)) await this.router.navigate(['/tabs/telehealth/session', item.id]);
  }
}
