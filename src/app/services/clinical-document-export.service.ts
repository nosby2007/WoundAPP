import { Injectable, inject } from '@angular/core';
import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { ClinicalAuditService } from './clinical-audit.service';
import { ClinicalDocumentSnapshotService } from './clinical-document-snapshot.service';

export type ClinicalDocumentKind =
  | 'visit'
  | 'assessment'
  | 'braden'
  | 'systemic'
  | 'carePlan'
  | 'order'
  | 'education'
  | 'woundAssessment'
  | 'progressNote';

export interface ClinicalPacketSection {
  kind: ClinicalDocumentKind;
  title: string;
  records: Array<{ id: string; data: any }>;
}

@Injectable({ providedIn: 'root' })
export class ClinicalDocumentExportService {
  private audit = inject(ClinicalAuditService);
  private snapshots = inject(ClinicalDocumentSnapshotService);
  async printSection(patientId: string, kind: ClinicalDocumentKind, recordId?: string): Promise<void> {
    const html = await this.buildDocument(patientId, [kind], recordId ? { [kind]: recordId } : {});
    await this.audit.record({ action: 'document_printed', patientId, entityType: kind, entityId: recordId || null, metadata: { kind } });
    this.openPrintWindow(html);
  }

  async printVisitPacket(
    patientId: string,
    visitId?: string | null,
    appointmentId?: string | null
  ): Promise<void> {
    const html = await this.buildVisitPacket(patientId, visitId || null, appointmentId || null);
    await this.audit.record({
      action: 'visit_packet_printed',
      patientId,
      entityType: 'visitPacket',
      entityId: visitId || null,
      metadata: { visitId: visitId || null, appointmentId: appointmentId || null, format: 'structured_visit_record' },
    });
    this.openPrintWindow(html);
  }

  async shareSection(patientId: string, kind: ClinicalDocumentKind, recordId?: string): Promise<'shared' | 'print'> {
    const html = await this.buildDocument(patientId, [kind], recordId ? { [kind]: recordId } : {});
    const title = this.kindTitle(kind);
    const snapshot = await this.snapshots.finalize({
      patientId,
      kind,
      title,
      html,
      sourceRefs: recordId ? [{ path: kind, id: recordId }] : [],
    });
    const filename = `${this.safeFileName(title)}-${new Date().toISOString().slice(0, 10)}.html`;
    const blob = new Blob([html], { type: 'text/html' });
    const file = new File([blob], filename, { type: 'text/html' });
    const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };

    if (navigator.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
      await navigator.share({
        title,
        text: 'Clinical document generated from the patient chart. Use an approved secure destination for protected health information.',
        files: [file],
      });
      await this.audit.record({ action: 'document_shared', patientId, entityType: 'documentSnapshot', entityId: snapshot.id, metadata: { kind } });
      return 'shared';
    }

    this.openPrintWindow(html);
    return 'print';
  }

  async shareVisitPacket(
    patientId: string,
    visitId?: string | null,
    appointmentId?: string | null
  ): Promise<'shared' | 'print'> {
    const html = await this.buildVisitPacket(patientId, visitId || null, appointmentId || null);
    const title = 'Clinical Visit Record';
    const snapshot = await this.snapshots.finalize({
      patientId,
      kind: 'visitPacket',
      title,
      html,
      sourceRefs: visitId ? [{ path: `patients/${patientId}/woundVisits`, id: visitId }] : [],
    });
    const filename = `clinical-visit-record-${new Date().toISOString().slice(0, 10)}.html`;
    const blob = new Blob([html], { type: 'text/html' });
    const file = new File([blob], filename, { type: 'text/html' });
    const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };

    if (navigator.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
      await navigator.share({
        title,
        text: 'Structured clinical visit record. Send only through an approved secure destination.',
        files: [file],
      });
      await this.audit.record({
        action: 'visit_packet_shared',
        patientId,
        entityType: 'documentSnapshot',
        entityId: snapshot.id,
        metadata: { visitId: visitId || null, appointmentId: appointmentId || null, format: 'structured_visit_record' },
      });
      return 'shared';
    }

    this.openPrintWindow(html);
    return 'print';
  }

  private async buildVisitPacket(
    patientId: string,
    requestedVisitId: string | null,
    requestedAppointmentId: string | null
  ): Promise<string> {
    if (!patientId) throw new Error('Patient is required.');

    const patientSnap = await getDoc(doc(db, 'patients', patientId));
    if (!patientSnap.exists()) throw new Error('Patient not found.');
    const patient: any = patientSnap.data();
    const patientName = patient.name || patient.displayName || patient.fullName || 'Patient';

    const visitSection = await this.loadSection(patientId, 'visit');
    const sortedVisits = [...visitSection.records].sort((a, b) => this.dateMillis(b.data) - this.dateMillis(a.data));
    const visitRecord =
      (requestedVisitId ? sortedVisits.find((row) => row.id === requestedVisitId) : null) ||
      (requestedAppointmentId
        ? sortedVisits.find((row) => String(row.data?.appointmentId || '') === requestedAppointmentId)
        : null) ||
      sortedVisits[0];

    if (!visitRecord) throw new Error('No wound visit is available for this patient.');

    const visit = visitRecord.data || {};
    const visitId = visitRecord.id;
    const appointmentId = String(visit.appointmentId || requestedAppointmentId || '') || null;

    const sectionKinds: ClinicalDocumentKind[] = [
      'assessment',
      'braden',
      'systemic',
      'carePlan',
      'order',
      'education',
      'woundAssessment',
      'progressNote',
    ];
    const sections: ClinicalPacketSection[] = [];
    for (const kind of sectionKinds) {
      const section = await this.loadSection(patientId, kind);
      const linked = section.records.filter((row) => this.belongsToVisit(row.data, visitId, appointmentId));
      if (linked.length) sections.push({ ...section, records: linked });
    }

    let clinicianProfile: any = null;
    const clinicianUid = visit.performedByUid || visit.clinicianUid || visit.authorIdentity?.uid || null;
    if (clinicianUid) {
      const clinicianSnap = await getDoc(doc(db, 'users', clinicianUid)).catch(() => null);
      clinicianProfile = clinicianSnap?.exists() ? clinicianSnap.data() : null;
    }

    let org: any = null;
    const orgId = patient.orgId || patient.orgID || visit.orgId || null;
    if (orgId) {
      const orgSnap = await getDoc(doc(db, 'organizations', orgId)).catch(() => null);
      org = orgSnap?.exists() ? orgSnap.data() : null;
    }

    const generatedAt = new Date();
    const serviceDate =
      this.toDate(visit.checkIn?.occurredAt || visit.checkIn?.deviceReportedAt || visit.scheduledFor || visit.createdAt) ||
      generatedAt;
    const clinicianName =
      visit.performedByName ||
      visit.clinicianName ||
      visit.authorIdentity?.displayName ||
      clinicianProfile?.displayName ||
      'Not documented';
    const clinicianCredentials =
      visit.authorIdentity?.credentials ||
      clinicianProfile?.credentials ||
      clinicianProfile?.professionalTitle ||
      null;
    const clinicianNpi = visit.authorIdentity?.npi || clinicianProfile?.npi || clinicianProfile?.NPI || null;
    const clinicianLicense = clinicianProfile?.licenseNumber || clinicianProfile?.licenseNo || clinicianProfile?.license || null;
    const clinicianLicenseState = clinicianProfile?.licenseState || clinicianProfile?.licenseJurisdiction || null;

    const readiness = this.packetReadiness(visit, sections);
    const sectionHtml = sections.map((section) => this.renderClinicalSection(section)).join('');
    const manifestRows = [
      { title: 'Encounter / EVV', count: 1 },
      ...sections.map((section) => ({ title: section.title, count: section.records.length })),
    ].map((item) => `<tr><td>${this.escape(item.title)}</td><td>${item.count}</td></tr>`).join('');

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${this.escape(patientName)} — Clinical Visit Record</title>
<style>
  @page { size: Letter; margin: 0.55in 0.55in 0.62in; }
  * { box-sizing: border-box; }
  body { font-family: Arial, "Helvetica Neue", sans-serif; color:#14213d; margin:0; background:#fff; font-size:10.5pt; line-height:1.38; }
  .letterhead { display:flex; justify-content:space-between; gap:24px; border-bottom:3px solid #14532d; padding-bottom:12px; margin-bottom:16px; }
  .org { font-size:10pt; color:#475569; }
  h1 { font-size:22pt; margin:2px 0 3px; color:#0f172a; }
  h2 { font-size:13pt; margin:0; }
  h3 { font-size:11pt; margin:0 0 8px; }
  .subtitle { color:#475569; font-size:10pt; }
  .confidential { text-align:right; font-size:8.5pt; color:#64748b; }
  .status { margin:0 0 14px; padding:9px 11px; border:1px solid #dbe4e8; background:#f8fafc; }
  .status.ready { border-color:#86efac; background:#f0fdf4; color:#166534; }
  .status.review { border-color:#facc15; background:#fffbeb; color:#854d0e; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:0 0 14px; }
  .card { border:1px solid #cbd5e1; padding:10px 12px; break-inside:avoid; }
  .card-title { font-size:8pt; font-weight:700; letter-spacing:.08em; color:#64748b; text-transform:uppercase; margin-bottom:6px; }
  .kv { display:grid; grid-template-columns:135px 1fr; gap:8px; padding:3px 0; border-bottom:1px solid #eef2f7; }
  .kv:last-child { border-bottom:0; }
  .k { font-weight:700; color:#334155; }
  .section { margin:0 0 16px; }
  .section-head { border-bottom:2px solid #14532d; padding:0 0 5px; margin:0 0 8px; }
  .record { border:1px solid #dbe3e9; padding:9px 10px; margin:0 0 8px; break-inside:avoid; }
  .record-title { display:flex; justify-content:space-between; gap:12px; font-weight:700; margin-bottom:5px; }
  .record-meta { font-size:8pt; color:#64748b; margin-top:6px; }
  table { border-collapse:collapse; width:100%; }
  th, td { border-bottom:1px solid #dbe3e9; padding:5px 6px; text-align:left; vertical-align:top; }
  th { background:#f8fafc; font-size:8.5pt; color:#475569; }
  .signature { margin-top:16px; border-top:1px solid #94a3b8; padding-top:8px; }
  .small { font-size:8pt; color:#64748b; }
  .page-break { break-before:page; }
  footer { margin-top:20px; border-top:1px solid #cbd5e1; padding-top:8px; font-size:8pt; color:#64748b; }
  @media print {
    body { print-color-adjust:exact; -webkit-print-color-adjust:exact; }
    .section, .record, .card { break-inside:avoid; }
  }
</style>
</head>
<body>
  <div class="letterhead">
    <div>
      <div class="org">${this.escape(org?.legalName || org?.name || org?.displayName || 'Clinical Organization')}</div>
      <h1>Clinical Visit Record</h1>
      <div class="subtitle">Transferable encounter documentation · Service date ${this.escape(serviceDate.toLocaleDateString())}</div>
    </div>
    <div class="confidential">
      CONFIDENTIAL CLINICAL RECORD<br>
      Generated ${this.escape(generatedAt.toLocaleString())}<br>
      Patient ID: ${this.escape(patient.mrn || patient.patientId || patientId)}
    </div>
  </div>

  <div class="status ${readiness.ready ? 'ready' : 'review'}">
    <strong>${readiness.ready ? 'Record assembled for professional review' : 'Record requires review before external release'}</strong>
    ${readiness.items.length ? `<div>${readiness.items.map((item) => this.escape(item)).join(' · ')}</div>` : ''}
  </div>

  <div class="grid">
    <div class="card">
      <div class="card-title">Patient face sheet</div>
      ${this.packetKv('Name', patientName)}
      ${this.packetKv('Date of birth', this.dateOnly(patient.dob || patient.dateOfBirth))}
      ${this.packetKv('MRN / Patient ID', patient.mrn || patient.patientId || patientId)}
      ${this.packetKv('Phone', patient.phone || patient.phoneNumber)}
      ${this.packetKv('Primary payer', patient.insuranceProvider || patient.payerName || patient.insurance?.name)}
      ${this.packetKv('Member ID', patient.memberId || patient.insuranceMemberId || patient.insurance?.memberId)}
    </div>
    <div class="card">
      <div class="card-title">Encounter</div>
      ${this.packetKv('Visit type', visit.visitType || 'Wound visit')}
      ${this.packetKv('Place of service', visit.placeOfService)}
      ${this.packetKv('Status', visit.fieldVisitState || visit.status)}
      ${this.packetKv('Scheduled', this.dateText(visit.scheduledFor))}
      ${this.packetKv('Check-in', this.dateText(visit.checkIn?.occurredAt || visit.checkIn?.deviceReportedAt))}
      ${this.packetKv('Check-out', this.dateText(visit.checkOut?.occurredAt || visit.checkOut?.deviceReportedAt))}
    </div>
  </div>

  <section class="section">
    <div class="section-head"><h2>Rendering clinician</h2></div>
    <div class="card">
      ${this.packetKv('Clinician', clinicianName)}
      ${this.packetKv('Credentials', clinicianCredentials)}
      ${this.packetKv('License', clinicianLicense ? `${clinicianLicense}${clinicianLicenseState ? ` (${clinicianLicenseState})` : ''}` : null)}
      ${this.packetKv('NPI', clinicianNpi)}
      ${this.packetKv('Role', visit.performedByRole || visit.clinicianRole || visit.authorIdentity?.role || clinicianProfile?.role)}
    </div>
  </section>

  <section class="section">
    <div class="section-head"><h2>Encounter verification / EVV</h2></div>
    <div class="grid">
      <div class="card">
        <div class="card-title">Arrival</div>
        ${this.packetKv('Time', this.dateText(visit.checkIn?.occurredAt || visit.checkIn?.deviceReportedAt))}
        ${this.packetKv('Location status', visit.checkIn?.location?.status)}
        ${this.packetKv('Location note', visit.checkIn?.location?.reason || visit.checkIn?.location?.message)}
      </div>
      <div class="card">
        <div class="card-title">Departure</div>
        ${this.packetKv('Time', this.dateText(visit.checkOut?.occurredAt || visit.checkOut?.deviceReportedAt))}
        ${this.packetKv('Location status', visit.checkOut?.location?.status)}
        ${this.packetKv('Attestation', visit.patientAttestation?.method)}
        ${this.packetKv('Confirmed by', visit.patientAttestation?.name || visit.patientAttestation?.attestedByName)}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="section-head"><h2>Clinical document manifest</h2></div>
    <table>
      <thead><tr><th>Document category</th><th>Records linked to this encounter</th></tr></thead>
      <tbody>${manifestRows}</tbody>
    </table>
  </section>

  ${sectionHtml || '<section class="section"><div class="section-head"><h2>Clinical documentation</h2></div><div class="card">No additional records are explicitly linked to this encounter.</div></section>'}

  <section class="section page-break">
    <div class="section-head"><h2>Authentication and source statement</h2></div>
    <div class="card">
      <p>This record was compiled from chart documents explicitly linked to the selected clinical encounter. It does not merge unrelated historical visits and does not create new findings, diagnoses, measurements, orders, signatures, or EVV evidence.</p>
      <p><strong>Visit source ID:</strong> ${this.escape(visitId)}</p>
      ${appointmentId ? `<p><strong>Scheduler appointment ID:</strong> ${this.escape(appointmentId)}</p>` : ''}
      <div class="signature">
        <strong>Rendering clinician:</strong> ${this.escape([clinicianName, clinicianCredentials, clinicianNpi ? `NPI ${clinicianNpi}` : null].filter(Boolean).join(' · '))}
      </div>
    </div>
  </section>

  <footer>
    Confidential medical record. Verify recipient authorization before transmission. Generated from immutable/source chart records where available.
  </footer>
</body>
</html>`;
  }

  private belongsToVisit(data: any, visitId: string, appointmentId: string | null): boolean {
    if (!data || typeof data !== 'object') return false;
    const visitRefs = [
      data.visitId,
      data.woundVisitId,
      data.encounterId,
      data.clinicalVisitId,
      data.fieldEncounterVisitId,
      data.mobileWorkflow?.woundVisitId,
    ].filter(Boolean).map(String);
    if (visitRefs.includes(visitId)) return true;

    if (appointmentId) {
      const appointmentRefs = [
        data.appointmentId,
        data.mobileWorkflow?.appointmentId,
      ].filter(Boolean).map(String);
      if (appointmentRefs.includes(appointmentId)) return true;
    }
    return false;
  }

  private packetReadiness(visit: any, sections: ClinicalPacketSection[]): { ready: boolean; items: string[] } {
    const items: string[] = [];
    if (!visit.checkIn) items.push('Check-in not documented');
    if (!visit.checkOut) items.push('Check-out not documented');
    if (!sections.some((section) => section.kind === 'woundAssessment' && section.records.length)) {
      items.push('No wound assessment linked to this encounter');
    }
    if (!sections.some((section) => section.kind === 'carePlan' && section.records.length)) {
      items.push('No care plan linked to this encounter');
    }
    if (!sections.some((section) => section.kind === 'progressNote' && section.records.length)) {
      items.push('No progress note linked to this encounter');
    }
    return { ready: items.length === 0, items };
  }

  private renderClinicalSection(section: ClinicalPacketSection): string {
    return `<section class="section">
      <div class="section-head"><h2>${this.escape(section.title)}</h2></div>
      ${section.records.map((record) => this.renderClinicalRecord(section.kind, record)).join('')}
    </section>`;
  }

  private renderClinicalRecord(kind: ClinicalDocumentKind, record: { id: string; data: any }): string {
    const d = record.data || {};
    const lines: Array<[string, any]> = [];

    if (kind === 'assessment') {
      lines.push(
        ['Reason / focus', d.reason || d.chiefComplaint || d.focus],
        ['General status', d.status || d.generalStatus],
        ['Pain', d.pain || d.painScore],
        ['Relevant findings', d.findings || d.summary || d.notes]
      );
    } else if (kind === 'braden') {
      lines.push(
        ['Braden score', d.totalScore || d.score || d.bradenScore],
        ['Risk level', d.riskLevel || d.risk],
        ['Interventions', this.textValue(d.interventions || d.recommendations)]
      );
    } else if (kind === 'systemic') {
      lines.push(
        ['General', d.general || d.generalAppearance],
        ['Cardiovascular', d.cardiovascular],
        ['Respiratory', d.respiratory],
        ['Neurologic', d.neurologic],
        ['GI / GU', this.textValue([d.gastrointestinal, d.genitourinary].filter(Boolean))),
        ['Other findings', d.summary || d.notes]
      );
    } else if (kind === 'carePlan') {
      lines.push(
        ['Status', d.status || d.workflow?.state],
        ['Goals', this.textValue(d.goals || d.goal || d.primaryGoal)],
        ['Interventions', this.textValue(d.interventions || d.plan || d.treatmentPlan)],
        ['Frequency / follow-up', d.frequency || d.followUp || d.followUpPlan]
      );
    } else if (kind === 'order') {
      lines.push(
        ['Order', d.description || d.orderText || d.order || d.orderType],
        ['Instructions', d.instructions || d.directions],
        ['Frequency', d.frequency],
        ['Status', d.status || d.workflow?.state],
        ['Prescriber', d.orderedBy?.displayName || d.prescriberName || d.providerName]
      );
    } else if (kind === 'education') {
      lines.push(
        ['Topic', d.topic || d.title],
        ['Learner', this.textValue(d.learners || d.learner)],
        ['Teaching / instructions', d.content || d.education || d.instructions || d.notes],
        ['Response / understanding', this.textValue(d.response || d.understanding)]
      );
    } else if (kind === 'woundAssessment') {
      const desc = d.describe || {};
      const m = d.measurements || {};
      lines.push(
        ['Wound', [desc.type || d.type, desc.stage || d.stage, desc.location || d.location].filter(Boolean).join(' · ')],
        ['Measurements', this.measurementValue(m, d)],
        ['Wound bed / tissue', this.textValue(desc.tissue || d.tissue || d.woundBed)],
        ['Drainage', this.textValue(desc.drainage || d.drainage)],
        ['Periwound / surrounding skin', this.textValue(desc.periwound || d.periwound || d.surrounding)],
        ['Progress', d.progress?.status || d.status],
        ['Treatment performed', this.textValue(d.treatment || d.treatmentPerformed || d.interventions)]
      );
    } else if (kind === 'progressNote') {
      lines.push(
        ['Reason for visit', d.reason || d.chiefComplaint],
        ['Clinical narrative', d.noteNarrative || d.narrative || d.note || d.details],
        ['Assessment / impression', d.assessment || d.impression],
        ['Plan', d.planNarrative || d.plan],
        ['Follow-up', d.followUp]
      );
    }

    const body = lines
      .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
      .map(([label, value]) => this.packetKv(label, this.textValue(value)))
      .join('') || '<div class="small">No structured printable fields were documented for this record.</div>';

    const signer = this.signerLabel(d);
    return `<div class="record">
      <div class="record-title">
        <span>${this.escape(this.recordTitle(kind, d))}</span>
        <span class="small">${this.escape(this.dateText(d.assessedAt || d.effectiveAt || d.orderedAt || d.deliveredAt || d.createdAt) || '')}</span>
      </div>
      ${body}
      <div class="record-meta">Source record ${this.escape(record.id)}${signer ? ` · ${this.escape(signer)}` : ''}</div>
    </div>`;
  }

  private recordTitle(kind: ClinicalDocumentKind, d: any): string {
    if (kind === 'woundAssessment') {
      const desc = d.describe || {};
      return [desc.location || d.location, desc.type || d.type, 'Wound assessment'].filter(Boolean).join(' — ');
    }
    if (kind === 'order') return d.orderType || d.title || 'Clinical order';
    if (kind === 'education') return d.topic || d.title || 'Patient / caregiver education';
    if (kind === 'carePlan') return d.title || 'Plan of care';
    if (kind === 'progressNote') return d.noteType || d.type || 'Clinical progress note';
    return this.kindTitle(kind);
  }

  private signerLabel(data: any): string {
    const signer =
      data.signature?.signer ||
      data.esign?.signerIdentity ||
      data.signerIdentity ||
      data.signatureIdentity ||
      data.authorIdentity ||
      data.orderedBy ||
      null;
    if (!signer || typeof signer !== 'object') return '';
    return [
      signer.displayName,
      signer.credentials,
      signer.licenseNumber ? `License ${signer.licenseNumber}${signer.licenseState ? ` (${signer.licenseState})` : ''}` : null,
      signer.npi ? `NPI ${signer.npi}` : null,
    ].filter(Boolean).join(' · ');
  }

  private packetKv(label: string, value: any): string {
    const text = this.textValue(value);
    return `<div class="kv"><div class="k">${this.escape(label)}</div><div>${this.escape(text || 'Not documented')}</div></div>`;
  }

  private measurementValue(m: any, d: any): string {
    const length = m.length ?? d.length ?? d.lengthCm;
    const width = m.width ?? d.width ?? d.widthCm;
    const depth = m.depth ?? d.depth ?? d.depthCm;
    if ([length, width, depth].every((v) => v === null || v === undefined || v === '')) return '';
    return `${length ?? '—'} × ${width ?? '—'} × ${depth ?? '—'} cm`;
  }

  private textValue(value: any): string {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) return value.map((item) => this.textValue(item)).filter(Boolean).join('; ');
    if (typeof value === 'object') {
      return Object.entries(value)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => `${this.prettyLabel(k)}: ${this.textValue(v)}`)
        .join('; ');
    }
    return String(value);
  }

  private dateOnly(value: any): string {
    const date = this.toDate(value);
    return date ? date.toLocaleDateString() : (typeof value === 'string' ? value : 'Not documented');
  }

  private dateText(value: any): string {
    const date = this.toDate(value);
    return date ? date.toLocaleString() : (typeof value === 'string' ? value : '');
  }

  private async buildDocument(
    patientId: string,
    kinds: ClinicalDocumentKind[],
    recordIds: Partial<Record<ClinicalDocumentKind, string>> = {},
  ): Promise<string> {
    if (!patientId) throw new Error('Patient is required.');

    const patientSnap = await getDoc(doc(db, 'patients', patientId));
    if (!patientSnap.exists()) throw new Error('Patient not found.');
    const patient: any = patientSnap.data();
    const patientName = patient.name || patient.displayName || 'Patient';

    const sections: ClinicalPacketSection[] = [];
    for (const kind of kinds) {
      const section = await this.loadSection(patientId, kind, recordIds[kind]);
      if (section.records.length) sections.push(section);
    }

    const generatedAt = new Date();
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${this.escape(patientName)} — Clinical Document</title>
<style>
  @page { size: auto; margin: 0.55in; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif; color:#172033; margin:0; background:#fff; font-size:12px; line-height:1.45; }
  header { border-bottom:3px solid #176b54; padding-bottom:14px; margin-bottom:18px; }
  h1 { margin:0 0 5px; font-size:22px; }
  .sub { color:#5f6f7f; }
  .section { page-break-inside:avoid; margin:0 0 22px; }
  .section h2 { margin:0 0 10px; padding:8px 10px; background:#eef7f3; border-left:4px solid #176b54; font-size:16px; }
  .record { border:1px solid #dbe3e9; border-radius:8px; padding:10px 12px; margin:0 0 10px; page-break-inside:avoid; }
  .record-id { font-size:9px; color:#7a8793; margin-bottom:6px; }
  dl { margin:0; }
  .row { display:grid; grid-template-columns:170px 1fr; gap:10px; padding:4px 0; border-bottom:1px solid #eef2f5; }
  .row:last-child { border-bottom:0; }
  dt { font-weight:700; color:#324355; }
  dd { margin:0; white-space:pre-wrap; word-break:break-word; }
  .empty { color:#7a8793; font-style:italic; }
  footer { margin-top:26px; border-top:1px solid #dbe3e9; padding-top:10px; color:#6b7785; font-size:10px; }
  @media print { .no-print { display:none!important; } body { print-color-adjust:exact; -webkit-print-color-adjust:exact; } }
</style>
</head>
<body>
<header>
  <h1>${this.escape(patientName)}</h1>
  <div class="sub">Clinical document packet · Generated ${this.escape(generatedAt.toLocaleString())}</div>
</header>
${sections.map((section) => this.renderSection(section)).join('')}
<footer>
  Generated from the clinical chart. Verify recipient authorization and use an approved secure channel for protected health information.
</footer>
</body>
</html>`;
  }

  private async loadSection(patientId: string, kind: ClinicalDocumentKind, recordId?: string): Promise<ClinicalPacketSection> {
    const config: Record<ClinicalDocumentKind, { title: string; path: string; filter?: (d: any) => boolean }> = {
      visit: { title: 'Visit / Check-in & Check-out', path: `patients/${patientId}/woundVisits` },
      assessment: { title: 'Patient Assessment', path: `patients/${patientId}/assessments`, filter: (d) => d.kind !== 'braden' && d.kind !== 'systemic_assessment' },
      braden: { title: 'Braden Risk Assessment', path: `patients/${patientId}/assessments`, filter: (d) => d.kind === 'braden' },
      systemic: { title: 'Physical / Systemic Assessment', path: `patients/${patientId}/assessments`, filter: (d) => d.kind === 'systemic_assessment' },
      carePlan: { title: 'Care Plan', path: `patients/${patientId}/carePlans` },
      order: { title: 'Orders', path: `patients/${patientId}/orders` },
      education: { title: 'Patient / Caregiver Education', path: `patients/${patientId}/educationRecords` },
      woundAssessment: { title: 'Wound Assessment', path: `patients/${patientId}/woundAssessments` },
      progressNote: { title: 'Progress Notes', path: `patients/${patientId}/providerNotes` },
    };

    const cfg = config[kind];
    const snap = await getDocs(collection(db, cfg.path));
    let rows = snap.docs.map((entry) => ({ id: entry.id, data: entry.data() as any }));
    if (cfg.filter) rows = rows.filter((row) => cfg.filter!(row.data));
    if (recordId) rows = rows.filter((row) => row.id === recordId);

    rows.sort((a, b) => this.dateMillis(b.data) - this.dateMillis(a.data));
    return { kind, title: cfg.title, records: rows };
  }

  private renderSection(section: ClinicalPacketSection): string {
    return `<section class="section">
      <h2>${this.escape(section.title)}</h2>
      ${section.records.map((record) => `<div class="record">
        <div class="record-id">Record ${this.escape(record.id)}</div>
        <dl>${this.renderObject(record.data)}</dl>
      </div>`).join('')}
    </section>`;
  }

  private renderObject(value: any, prefix = ''): string {
    if (!value || typeof value !== 'object') return '';
    const hidden = new Set(['photoURL', 'storagePath', 'downloadURL']);
    const rows: string[] = [];

    Object.keys(value).sort().forEach((key) => {
      if (hidden.has(key)) return;
      const current = value[key];
      if (current === undefined || current === null || current === '') return;
      const label = prefix ? `${prefix} › ${key}` : key;

      if (this.isTimestamp(current)) {
        rows.push(this.row(label, this.toDate(current)?.toLocaleString() || ''));
      } else if (Array.isArray(current)) {
        if (!current.length) return;
        const primitive = current.every((item) => item === null || ['string', 'number', 'boolean'].includes(typeof item));
        if (primitive) rows.push(this.row(label, current.filter((x) => x !== null).join(', ')));
        else current.forEach((item, index) => {
          if (item && typeof item === 'object') rows.push(this.renderObject(item, `${label} #${index + 1}`));
        });
      } else if (typeof current === 'object') {
        rows.push(this.renderObject(current, label));
      } else {
        rows.push(this.row(label, String(current)));
      }
    });

    return rows.join('') || '<div class="empty">No printable fields.</div>';
  }

  private row(label: string, value: string): string {
    return `<div class="row"><dt>${this.escape(this.prettyLabel(label))}</dt><dd>${this.escape(value)}</dd></div>`;
  }

  private prettyLabel(value: string): string {
    return value
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (m) => m.toUpperCase());
  }

  private dateMillis(data: any): number {
    for (const key of ['effectiveAt', 'assessedAt', 'deliveredAt', 'orderedAt', 'createdAt', 'updatedAt', 'scheduledFor']) {
      const date = this.toDate(data?.[key]);
      if (date) return date.getTime();
    }
    return 0;
  }

  private isTimestamp(value: any): boolean {
    return !!value && typeof value === 'object' && (typeof value.toDate === 'function' || typeof value.seconds === 'number');
  }

  private toDate(value: any): Date | null {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
    if (value instanceof Date) return value;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  private openPrintWindow(html: string): void {
    const win = window.open('', '_blank');
    if (!win) throw new Error('Allow pop-ups to open the printable document.');
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 250);
  }

  private kindTitle(kind: ClinicalDocumentKind): string {
    const titles: Record<ClinicalDocumentKind, string> = {
      visit: 'Visit Record',
      assessment: 'Patient Assessment',
      braden: 'Braden Assessment',
      systemic: 'Systemic Assessment',
      carePlan: 'Care Plan',
      order: 'Clinical Order',
      education: 'Patient Education',
      woundAssessment: 'Wound Assessment',
      progressNote: 'Progress Note',
    };
    return titles[kind];
  }

  private safeFileName(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  private escape(value: string): string {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
