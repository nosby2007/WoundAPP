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
    const visitRecord = requestedVisitId
      ? sortedVisits.find(row => row.id === requestedVisitId)
      : requestedAppointmentId
        ? sortedVisits.find(row => String(row.data?.appointmentId || '') === requestedAppointmentId)
        : sortedVisits[0];

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
      this.toDate(visit.checkIn?.at || visit.checkIn?.occurredAt || visit.checkIn?.deviceReportedAt || visit.scheduledFor) ||
      null;
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
      { title: 'Clinical encounter', count: 1 },
      ...sections.map((section) => ({ title: section.title, count: section.records.length })),
    ].map((item) => `<tr><td>${this.escape(item.title)}</td><td>${item.count}</td></tr>`).join('');

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${this.escape(patientName)} — Clinical Visit Record</title>
<style>
  @page { size: A4; margin: 16mm; }
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
  .kv { padding:5px 0; }
  .kv h3 { color:#176b54; font-size:10pt; margin:6px 0 3px; break-after:avoid; }
  .kv p { margin:0 0 6px; orphans:3; widows:3; }
  .kv:last-child { border-bottom:0; }
  .k { font-weight:700; color:#334155; }
  .section { margin:0 0 16px; }
  .section-head { border-bottom:2px solid #14532d; padding:0 0 5px; margin:0 0 8px; }
  .record { padding:9px 0; margin:0 0 8px; }
  .record-title { display:flex; justify-content:space-between; gap:12px; font-weight:700; margin-bottom:5px; }
  .record-meta { font-size:8pt; color:#64748b; margin-top:6px; }
  table { border-collapse:collapse; width:100%; }
  th, td { border-bottom:1px solid #dbe3e9; padding:5px 6px; text-align:left; vertical-align:top; }
  th { background:#f8fafc; font-size:8.5pt; color:#475569; }
  .signature { margin-top:16px; border-top:1px solid #94a3b8; padding-top:8px; }
  .small { font-size:8pt; color:#64748b; }
  .page-break { break-before:page; }
  footer { margin-top:20px; border-top:1px solid #cbd5e1; padding-top:8px; font-size:8pt; color:#64748b; }
  .print-document {width:100%;border-collapse:collapse} .print-document>thead>tr>td,.print-document>tbody>tr>td{border:0;padding:0}
  @media print {
    body { print-color-adjust:exact; -webkit-print-color-adjust:exact; }
    h2,h3 { break-after:avoid; } .card { break-inside:avoid; } thead {display:table-header-group}
  }
</style>
</head>
<body>
  <table class="print-document"><thead><tr><td>
  <div class="letterhead">
    <div>
      <div class="org">Perry Home Wound Care</div>
      <p>Tel: 478-310-4446 · Fax: 478-721-9473<br>support@perryhomewoundcare.network</p>
      <h1>Clinical Visit Record</h1>
      <div class="subtitle">Service date ${this.escape(serviceDate?.toLocaleDateString() || 'Not documented')}</div>
    </div>
    <div class="confidential">
      CONFIDENTIAL CLINICAL RECORD<br>
      Patient: ${this.escape(patientName)}<br>
      Date of birth: ${this.escape(this.dateOnly(patient.dob || patient.dateOfBirth))}
    </div>
  </div>
  </td></tr></thead><tbody><tr><td>


  <div class="grid">
    <div class="card">
      <div class="card-title">Patient face sheet</div>
      ${this.packetKv('Name', patientName)}
      ${this.packetKv('Date of birth', this.dateOnly(patient.dob || patient.dateOfBirth))}
      ${patient.mrn ? this.packetKv('Medical record number', patient.mrn) : ''}
      ${this.packetKv('Phone', patient.phone || patient.phoneNumber)}
      ${this.packetKv('Primary payer', patient.insuranceProvider || patient.payerName || patient.insurance?.name)}
      ${this.packetKv('Member ID', patient.memberId || patient.insuranceMemberId || patient.insurance?.memberId)}
    </div>
    <div class="card">
      <div class="card-title">Encounter</div>
      ${this.packetKv('Visit type', visit.visitType || 'Wound visit')}
      ${this.packetKv('Place of service', visit.placeOfService)}
      ${this.packetKv('Scheduled', this.dateText(visit.scheduledFor))}
      ${this.packetKv('Check-in', this.dateText(visit.checkIn?.at || visit.checkIn?.occurredAt || visit.checkIn?.deviceReportedAt))}
      ${this.packetKv('Check-out', this.dateText(visit.checkOut?.at || visit.checkOut?.occurredAt || visit.checkOut?.deviceReportedAt))}
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
    <div class="section-head"><h2>Encounter times</h2></div>
    <div class="grid">
      <div class="card">
        <div class="card-title">Arrival</div>
        ${this.packetKv('Time', this.dateText(visit.checkIn?.at || visit.checkIn?.occurredAt || visit.checkIn?.deviceReportedAt))}
      </div>
      <div class="card">
        <div class="card-title">Departure</div>
        ${this.packetKv('Time', this.dateText(visit.checkOut?.at || visit.checkOut?.occurredAt || visit.checkOut?.deviceReportedAt))}
        ${this.packetKv('Confirmed by', visit.patientAttestation?.name || visit.patientAttestation?.attestedByName)}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="section-head"><h2>Clinical documents</h2></div>
    <table>
      <thead><tr><th>Document category</th><th>Number of documents</th></tr></thead>
      <tbody>${manifestRows}</tbody>
    </table>
  </section>

  ${sectionHtml || '<section class="section"><div class="section-head"><h2>Clinical documentation</h2></div><div class="card">No additional records are explicitly linked to this encounter.</div></section>'}

  <section class="section">
    <div class="section-head"><h2>Clinical authentication</h2></div>
    <div class="card">
      <div class="signature">
        <strong>Rendering clinician:</strong> ${this.escape([clinicianName, clinicianCredentials, clinicianNpi ? `NPI ${clinicianNpi}` : null].filter(Boolean).join(' · '))}
      </div>
    </div>
  </section>
  </td></tr></tbody></table>
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
      const a = d.answers || d;
      lines.push(
        ['Reason / focus', a.reasonForVisit || a.reason || a.chiefComplaint || a.focus],
        ['General status', a.generalStatus],
        ['Pain', a.pain ?? a.painScore],
        ['Functional status', a.functionalStatus],
        ['Nutrition / hydration', a.nutritionHydration],
        ['Medication concerns', a.medicationConcerns],
        ['Safety concerns', a.safetyConcerns],
        ['Relevant findings', a.clinicalSummary || a.findings || a.summary || a.notes]
      );
    } else if (kind === 'braden') {
      const b = d.answers?.braden || d.braden || d;
      lines.push(
        ['Braden score', b.total ?? d.totalScore ?? d.score ?? d.bradenScore],
        ['Risk level', b.riskText || d.riskLevel || d.risk],
        ['Sensory perception', b.sensory], ['Moisture', b.moisture],
        ['Activity', b.activity], ['Mobility', b.mobility],
        ['Nutrition', b.nutrition], ['Friction / shear', b.friction],
        ['Interventions', this.textValue(d.interventions || d.recommendations)]
      );
    } else if (kind === 'systemic') {
      const systems = d.answers?.systems || d.systems || d;
      for (const key of ['general','headToToe','mentalStatus','neurologic','cardiovascular','respiratory','gastrointestinal','genitourinary','musculoskeletal','integumentary','psychological','pain','nutritionHydration','functionalMobility','safetyRisks','other']) {
        lines.push([this.prettyLabel(key), systems[key]]);
      }
      lines.push(['Clinical summary', d.answers?.clinicalSummary || d.clinicalSummary || d.summary || d.notes]);
    } else if (kind === 'carePlan') {
      lines.push(
        ['Status', d.status || d.workflow?.state],
        ['Description', d.description],
        ['Start date', this.dateOnly(d.startDate)],
        ['End date', this.dateOnly(d.endDate)],
        ['Goals', this.textValue(d.goals || d.goal || d.primaryGoal)],
        ['Problems and goals', this.textValue(d.clinicalProblems)],
        ['Interventions', this.textValue(d.interventions || d.plan || d.treatmentPlan)],
        ['Frequency / follow-up', d.frequency || d.followUp || d.followUpPlan]
      );
    } else if (kind === 'order') {
      lines.push(
        ['Order', d.description || d.orderText || d.order || d.orderType],
        ['Instructions', d.instructions || d.directions],
        ['Frequency', d.frequency],
        ['Duration', d.duration || d.routine?.duration],
        ['Status', d.status || d.workflow?.state],
        ['Prescriber', d.orderedBy?.displayName || d.prescriberName || d.providerName]
      );
    } else if (kind === 'education') {
      lines.push(
        ['Topic', d.topic || d.title],
        ['Learner', this.textValue(d.learners || d.learner)],
        ['Readiness to learn', d.readiness],
        ['Teaching method', d.method],
        ['Teaching / instructions', d.content || d.education || d.instructions || d.notes],
        ['Response / understanding', this.textValue(d.response || d.understanding)]
      );
    } else if (kind === 'woundAssessment') {
      const desc = d.describe || {};
      const m = d.measurements || {};
      lines.push(
        ['Wound', [desc.type || d.type, desc.stage || d.stage, desc.location || d.location].filter(Boolean).join(' · ')],
        ['Acquired', desc.acquired || d.acquired],
        ['Staged by', desc.stagedBy],
        ['Measurements', this.measurementValue(m, d)],
        ['Measured area', m.area !== undefined && m.area !== null ? `${m.area} cm²` : null],
        ['Measured volume', m.volume !== undefined && m.volume !== null ? `${m.volume} cm³` : null],
        ['Wound bed / tissue', this.textValue(desc.tissue || d.tissue || d.woundBed)],
        ['Drainage', this.textValue(desc.drainage || d.drainage)],
        ['Exudate', this.textValue(d.exudate)],
        ['Pain', this.textValue(d.pain)],
        ['Tunneling / undermining', [m.tunneling, m.undermining].filter(Boolean).join(' / ')],
        ['Periwound / surrounding skin', this.textValue(desc.periwound || d.periwound || d.surrounding)],
        ['Progress', this.textValue(d.progress)],
        ['Care goal', d.orders?.goalOfCare],
        ['Treatment performed', this.textValue(d.treatment || d.treatmentPerformed || d.interventions)],
        ['Debridement procedure', this.textValue(d.debridementProcedure || d.debridement)],
        ['Provider review', d.providerReview?.providerNote],
        ['Review decision', d.providerReview?.decision],
        ['Reviewed by', d.providerReview?.reviewedByName],
        ['Review date', this.dateText(d.providerReview?.reviewedAt)]
      );
    } else if (kind === 'progressNote') {
      lines.push(
        ['Reason for visit', d.reason || d.chiefComplaint],
        ['Clinical narrative', d.noteNarrative || d.narrative || d.note || d.details],
        ['Assessment / impression', d.assessment || d.impression],
        ['Plan', d.planNarrative || d.plan],
        ['Follow-up', d.followUp]
      );
      if (d.amendmentReason) lines.push(['Addendum reason', d.amendmentReason]);
    } else if (kind === 'visit') {
      lines.push(['Visit type', d.visitType], ['Scheduled date', this.dateText(d.scheduledFor)],
        ['Arrival', this.dateText(d.checkIn?.at || d.checkIn?.occurredAt || d.checkIn?.deviceReportedAt)],
        ['Departure', this.dateText(d.checkOut?.at || d.checkOut?.occurredAt || d.checkOut?.deviceReportedAt)],
        ['Clinician', d.performedByName || d.clinicianName], ['Billing provider', d.billingProviderName]);
    }

    const body = lines
      .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
      .map(([label, value]) => this.packetKv(label, this.textValue(value)))
      .join('') || '<div class="small">No structured printable fields were documented for this record.</div>';

    const signer = this.signerLabel(d);
    return `<div class="record">
      <h3 class="record-title">${this.escape(this.recordTitle(kind, d))}</h3>
      <p class="small">${this.escape(this.dateText(d.assessedAt || d.effectiveAt || d.orderedAt || d.deliveredAt || d.createdAt) || '')}</p>
      ${body}
      ${kind === 'woundAssessment' ? this.woundMedia(d) : ''}
      <p class="record-meta">${this.escape(signer)}</p>
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
    const author = data.authorIdentity?.displayName || data.createdByName || data.recordedByName || data.providerName || data.deliveredBy?.displayName || data.createdBy?.displayName;
    const signature = data.esign || data.signature;
    if (signature?.signed === true || data.signed === true) {
      const name = signature?.signerDisplayName || signature?.signerIdentity?.displayName || signature?.signer?.displayName || data.signatureIdentity?.displayName || data.signedByName;
      return [author ? `Documented by ${author}${data.authorIdentity?.credentials ? ', ' + data.authorIdentity.credentials : ''}` : null,
        name ? `Electronically signed by ${name}` : 'Electronically signed; signer name not recorded',
        this.dateText(signature?.signedAt || signature?.signedAtIso || data.signedAt)].filter(Boolean).join(' · ');
    }
    return [author ? `Documented by ${author}${data.authorIdentity?.credentials ? ', ' + data.authorIdentity.credentials : ''}` : null,
      data.draft === true || data.status === 'draft' ? 'Draft — not signed' : 'No electronic signature recorded'].filter(Boolean).join(' · ');
  }

  private packetKv(label: string, value: any): string {
    const text = this.textValue(value);
    return `<div class="kv"><h3>${this.escape(label)}</h3><p style="white-space:pre-wrap">${this.escape(text || 'Not documented')}</p></div>`;
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
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (this.isTimestamp(value) || value instanceof Date) return this.dateText(value);
    if (Array.isArray(value)) return value.map((item) => this.textValue(item)).filter(Boolean).join('; ');
    if (typeof value === 'object') {
      return Object.entries(value)
        .filter(([k, v]) => !this.isTechnicalField(k) && v !== null && v !== undefined && v !== '')
        .map(([k, v]) => `${this.prettyLabel(k)}: ${this.textValue(v)}`)
        .join('; ');
    }
    return String(value);
  }

  private woundMedia(d: any): string {
    const location = String(d.describe?.location || d.location || 'Wound');
    // Only the assessment's existing photograph, never patient profile images.
    const url = typeof d.photoURL === 'string' && /^https:\/\//i.test(d.photoURL) ? d.photoURL : null;
    const photo = url ? `<figure style="margin:8px 0;break-inside:avoid"><img src="${this.escape(url)}" alt="${this.escape(location)}" width="100" height="100" style="width:100px;height:100px;object-fit:contain;border:1px solid #dbe3e9"><figcaption>${this.escape(location)} · ${this.escape(this.dateText(d.assessedAt) || 'Date not documented')}</figcaption></figure>` : '';
    const history = Array.isArray(d.printMeasurementHistory) ? d.printMeasurementHistory : [];
    const number = (v: unknown): number | null => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
    const charts = [['area', 'Area (cm²)'], ['depth', 'Depth (cm)']].map(([field, title]) => {
      const points = history.map((r: any) => ({date: this.toDate(r.assessedAt), value: number(r.measurements?.[field])}));
      if (points.filter((p: any) => p.date && p.value !== null).length < 2) return '';
      const start = points[0].date!.getTime(), end = points[points.length - 1].date!.getTime();
      const max = Math.max(0, ...points.map((p: any) => p.value || 0)) || 1;
      const x = (p: any) => 48 + (p.date.getTime() - start) / Math.max(1, end - start) * 450;
      const y = (p: any) => 115 - p.value / max * 85;
      const marks = points.map((p: any, i: number) => {
        if (p.value === null) return ''; // Missing values break the line; no interpolation.
        const prev = points[i - 1];
        return `${prev && prev.value !== null ? `<line x1="${x(prev)}" y1="${y(prev)}" x2="${x(p)}" y2="${y(p)}" stroke="#176b54"/>` : ''}<circle cx="${x(p)}" cy="${y(p)}" r="3" fill="#176b54"/><text x="${x(p)}" y="${y(p) - 7}" text-anchor="middle" font-size="10">${p.value}</text>`;
      }).join('');
      return `<div style="break-inside:avoid;margin:12px 0"><h3>${title}</h3><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 550 155" role="img" aria-label="${title} over time" style="width:100%;max-width:550px"><line x1="48" y1="115" x2="510" y2="115" stroke="#8795a0"/><text x="38" y="118" font-size="10">0</text><text x="20" y="30" font-size="10">${max}</text>${marks}<text x="48" y="140" font-size="10">${this.escape(this.dateOnly(points[0].date))}</text><text x="498" y="140" text-anchor="end" font-size="10">${this.escape(this.dateOnly(points[points.length - 1].date))}</text></svg></div>`;
    }).join('');
    const table = history.length ? `<table style="width:100%;font-size:11px"><thead><tr><th>Date</th><th>Area (cm²)</th><th>Depth (cm)</th></tr></thead><tbody>${history.map((r: any) => `<tr><td>${this.escape(this.dateText(r.assessedAt))}</td><td>${number(r.measurements?.area) ?? 'Not documented'}</td><td>${number(r.measurements?.depth) ?? 'Not documented'}</td></tr>`).join('')}</tbody></table>` : '';
    return `${photo}${history.length ? `<div><h3>Wound measurement evolution — ${this.escape(location)}</h3>${charts || '<p>Insufficient dated measurements for a trend chart.</p>'}${table}</div>` : ''}`;
  }

  private isTechnicalField(key: string): boolean {
    return /(?:Id|Uid|Ids|Uids)$/.test(key) || /^(id|uid)$/i.test(key) ||
      ['orgId','facilityIds','identityVersion','capturedAtIso','source','sourceOfTruth','version','revision',
        'storagePath','downloadURL','photoURL','workflow','locked','createdAt','updatedAt','createdBy','updatedBy',
        'authorIdentity','signatureIdentity','esign','voiceProvenance','templateId','templateVersion',
        'goalCatalogRefs','interventionCatalogRefs','audit','metadata'].includes(key);
  }

  private dateOnly(value: any): string {
    // Birth dates and plan dates are calendar dates, not UTC instants.
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split('-');
      return `${month}/${day}/${year}`;
    }
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

    return this.documentHtml(patient, sections);
  }

  private documentHtml(patient: any, sections: ClinicalPacketSection[]): string {
    const patientName = patient.name || patient.displayName || 'Patient name not recorded';
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${this.escape(patientName)} — Clinical Document</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif; color:#172033; margin:0; background:#fff; font-size:12px; line-height:1.45; }
  header { border-bottom:3px solid #176b54; padding-bottom:14px; margin-bottom:18px; }
  h1 { margin:0 0 5px; font-size:22px; }
  .sub { color:#5f6f7f; }
  .section { margin:0 0 22px; }
  .section h2 { margin:0 0 10px; padding:8px 10px; background:#eef7f3; border-left:4px solid #176b54; font-size:16px; }
  .record { padding:10px 0; margin:0 0 10px; }
  h2,h3 { break-after:avoid; } h3 { font-size:13px; margin:10px 0 3px; color:#176b54; } p { margin:0 0 6px; orphans:3; widows:3; }
  .record-meta { break-before:avoid; break-inside:avoid; }
  .record-id { font-size:9px; color:#7a8793; margin-bottom:6px; }
  dl { margin:0; }
  .row { display:grid; grid-template-columns:170px 1fr; gap:10px; padding:4px 0; border-bottom:1px solid #eef2f5; }
  .row:last-child { border-bottom:0; }
  dt { font-weight:700; color:#324355; }
  dd { margin:0; white-space:pre-wrap; word-break:break-word; }
  .empty { color:#7a8793; font-style:italic; }
  footer { margin-top:26px; border-top:1px solid #dbe3e9; padding-top:10px; color:#6b7785; font-size:10px; }
  .print-document { width:100%; border-collapse:collapse; } .print-document td { padding:0; border:0; vertical-align:top; }
  @media print { .no-print { display:none!important; } body { print-color-adjust:exact; -webkit-print-color-adjust:exact; } thead {display:table-header-group} header {break-inside:avoid} }
</style>
</head>
<body>
<table class="print-document"><thead><tr><td>
<header>
  <h1>Perry Home Wound Care</h1>
  <p>Tel: 478-310-4446 · Fax: 478-721-9473<br>support@perryhomewoundcare.network</p>
  <h2>${this.escape(patientName)}</h2>
  ${patient.dob || patient.dateOfBirth ? `<p>Date of birth: ${this.escape(this.dateOnly(patient.dob || patient.dateOfBirth))}</p>` : ''}
</header>
</td></tr></thead><tbody><tr><td>
${sections.map((section) => this.renderClinicalSection(section)).join('')}
</td></tr></tbody></table>
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
    if (kind === 'woundAssessment') {
      for (const row of rows) {
        const woundId = row.data.woundId || row.id;
        const cutoff = this.toDate(row.data.assessedAt)?.getTime();
        row.data.printMeasurementHistory = cutoff === undefined ? [] : rows
          .filter(r => (r.data.woundId || r.id) === woundId && r.data.orgId === row.data.orgId
            && !!this.toDate(r.data.assessedAt) && this.toDate(r.data.assessedAt)!.getTime() <= cutoff)
          .map(r => ({assessedAt: r.data.assessedAt, measurements: r.data.measurements || {}}))
          .sort((a, b) => this.toDate(a.assessedAt)!.getTime() - this.toDate(b.assessedAt)!.getTime());
      }
    }
    if (cfg.filter) rows = rows.filter((row) => cfg.filter!(row.data));
    if (recordId) rows = rows.filter((row) => row.id === recordId);
    const names = new Map<string, string>();
    const nameFor = async (uid: unknown, orgId: unknown): Promise<string | null> => {
      if (typeof uid !== 'string' || !uid || typeof orgId !== 'string' || !orgId) return null;
      const key = `${orgId}:${uid}`;
      if (names.has(key)) return names.get(key) || null;
      try {
        const profile = await getDoc(doc(db, 'users', uid));
        const name = profile.exists() && profile.data()['orgId'] === orgId ? profile.data()['displayName'] || profile.data()['name'] : null;
        names.set(key, typeof name === 'string' ? name : '');
      } catch { names.set(key, ''); } // Missing directory access never prints the UID instead.
      return names.get(key) || null;
    };
    for (const row of rows) {
      const d = row.data;
      if (!d.authorIdentity?.displayName && !d.createdByName && !d.recordedByName && !d.providerName) {
        d.recordedByName = await nameFor(d.authorIdentity?.uid || d.recordedByUid || d.providerUid || d.createdByUid || (typeof d.createdBy === 'string' ? d.createdBy : d.createdBy?.uid), d.orgId);
      }
      if (d.esign?.signed && !d.esign.signerDisplayName && !d.esign.signerIdentity?.displayName) {
        d.esign.signerDisplayName = await nameFor(d.esign.signerUid, d.orgId);
      }
      if (d.signed && !d.signatureIdentity?.displayName && !d.signedByName) d.signedByName = await nameFor(d.signedByUid, d.orgId);
      if (d.providerReview && !d.providerReview.reviewedByName) d.providerReview.reviewedByName = await nameFor(d.providerReview.reviewedByUid, d.orgId);
    }

    if (kind === 'carePlan') {
      for (const row of rows) {
        const problems = await getDocs(collection(db, `${cfg.path}/${row.id}/problems`));
        let catalog = new Map<string, string>();
        if (row.data.orgId && problems.docs.some(p => (p.data()['goalCatalogRefs'] || []).length || (p.data()['interventionCatalogRefs'] || []).length)) {
          const entries = await getDocs(collection(db, `organizations/${row.data.orgId}/carePlanCatalog`));
          catalog = new Map(entries.docs.map(e => [e.id, String(e.data()['text'] || '')]));
        }
        row.data.clinicalProblems = problems.docs.map(p => {
          const d = p.data();
          const wording = (refs: unknown) => (Array.isArray(refs) ? refs : []).map(id => catalog.get(String(id)) || 'Referenced clinical wording unavailable');
          return {category: this.prettyLabel(String(d['category'] || '')),
            goals: [...wording(d['goalCatalogRefs']), ...(d['customGoals'] || [])],
            interventions: [...wording(d['interventionCatalogRefs']), ...(d['customInterventions'] || [])],
            status: d['status']};
        });
      }
    }

    rows.sort((a, b) => this.dateMillis(b.data) - this.dateMillis(a.data));
    return { kind, title: cfg.title, records: rows };
  }

  private renderSection(section: ClinicalPacketSection): string {
    return this.renderClinicalSection(section);
  }

  private renderObject(value: any, prefix = ''): string {
    if (!value || typeof value !== 'object') return '';
    const rows: string[] = [];

    Object.keys(value).sort().forEach((key) => {
      if (this.isTechnicalField(key)) return;
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
    // Wait for photographs before printing. Failed downloads are visibly unavailable.
    const images = Array.from(win.document.images);
    Promise.all(images.map(img => new Promise<void>(resolve => {
      const failed = () => { img.replaceWith(win.document.createTextNode('Wound photograph unavailable')); resolve(); };
      if (img.complete) { img.naturalWidth ? resolve() : failed(); return; }
      const timer = setTimeout(failed, 15000);
      img.onload = () => { clearTimeout(timer); resolve(); };
      img.onerror = () => { clearTimeout(timer); failed(); };
    }))).then(() => { if (!win.closed) win.print(); });
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
