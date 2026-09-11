import { Injectable, inject } from '@angular/core';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { ClinicalAuditService } from './clinical-audit.service';
import { ClinicalDocumentSnapshotService } from './clinical-document-snapshot.service';
import { TenantService } from './tenant.service';

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

export interface PreparedClinicalDocument {
  snapshotId: string;
  title: string;
  sha256: string;
}

@Injectable({ providedIn: 'root' })
export class ClinicalDocumentExportService {
  private audit = inject(ClinicalAuditService);
  private snapshots = inject(ClinicalDocumentSnapshotService);
  private tenant = inject(TenantService);

  async printSection(patientId: string, kind: ClinicalDocumentKind, recordId?: string): Promise<void> {
    const recordIds = recordId ? { [kind]: recordId } : {};
    const html = await this.buildDocument(patientId, [kind], recordIds, false);
    const sourceRefs = await this.collectSourceRefs(patientId, [kind], recordIds, false);
    const snapshot = await this.snapshots.finalize({
      patientId,
      kind,
      title: this.kindTitle(kind),
      html,
      sourceRefs,
    });
    await this.audit.record({ action: 'document_printed', patientId, entityType: 'documentSnapshot', entityId: snapshot.id, metadata: { kind } });
    this.openPrintWindow(html);
  }

  async printVisitPacket(patientId: string): Promise<void> {
    const kinds = this.packetKinds();
    const html = await this.buildDocument(patientId, kinds, {}, true);
    const sourceRefs = await this.collectSourceRefs(patientId, kinds, {}, true);
    const snapshot = await this.snapshots.finalize({
      patientId,
      kind: 'visitPacket',
      title: 'Clinical Visit Packet',
      html,
      sourceRefs,
    });
    await this.audit.record({ action: 'visit_packet_printed', patientId, entityType: 'documentSnapshot', entityId: snapshot.id });
    this.openPrintWindow(html);
  }

  async prepareSection(patientId: string, kind: ClinicalDocumentKind, recordId?: string): Promise<PreparedClinicalDocument> {
    const html = await this.buildDocument(patientId, [kind], recordId ? { [kind]: recordId } : {}, false);
    const title = this.kindTitle(kind);
    const sourceRefs = await this.collectSourceRefs(patientId, [kind], recordId ? { [kind]: recordId } : {}, false);
    const snapshot = await this.snapshots.finalize({
      patientId,
      kind,
      title,
      html,
      sourceRefs,
    });
    return { snapshotId: snapshot.id, title, sha256: snapshot.sha256 };
  }

  async prepareVisitPacket(patientId: string): Promise<PreparedClinicalDocument> {
    const html = await this.buildDocument(patientId, this.packetKinds(), {}, true);
    const kinds = this.packetKinds();
    const sourceRefs = await this.collectSourceRefs(patientId, kinds, {}, true);
    const snapshot = await this.snapshots.finalize({
      patientId,
      kind: 'visitPacket',
      title: 'Clinical Visit Packet',
      html,
      sourceRefs,
    });
    return { snapshotId: snapshot.id, title: 'Clinical Visit Packet', sha256: snapshot.sha256 };
  }

  /**
   * Backward-compatible share methods now prepare a controlled snapshot.
   * The UI routes the user to Managed Delivery instead of opening an
   * unrestricted device share sheet.
   */
  async shareSection(patientId: string, kind: ClinicalDocumentKind, recordId?: string): Promise<'prepared'> {
    await this.prepareSection(patientId, kind, recordId);
    return 'prepared';
  }

  async shareVisitPacket(patientId: string): Promise<'prepared'> {
    await this.prepareVisitPacket(patientId);
    return 'prepared';
  }

  private packetKinds(): ClinicalDocumentKind[] {
    return ['visit','assessment','braden','systemic','carePlan','order','education','woundAssessment','progressNote'];
  }

  private async buildDocument(
    patientId: string,
    kinds: ClinicalDocumentKind[],
    recordIds: Partial<Record<ClinicalDocumentKind, string>> = {},
    packetMode = false,
  ): Promise<string> {
    if (!patientId) throw new Error('Patient is required.');

    const patientSnap = await getDoc(doc(db, 'patients', patientId));
    if (!patientSnap.exists()) throw new Error('Patient not found.');
    const patient: any = patientSnap.data();

    const orgId = await this.tenant.currentOrgId();
    const org = orgId ? await this.readOrganization(orgId) : {};
    const orgName = org.displayName || org.name || org.legalName || 'Wound Care Clinical Services';
    const patientName = patient.name || patient.displayName || 'Patient';
    const mrn = patient.mrn || 'Pending MRN';
    const dob = this.displayDate(patient.dob);
    const generatedAt = new Date();

    const sections: ClinicalPacketSection[] = [];
    for (const kind of kinds) {
      const section = await this.loadSection(patientId, kind, recordIds[kind], packetMode);
      if (section.records.length) sections.push(section);
    }

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${this.escape(patientName)} — ${packetMode ? 'Clinical Visit Packet' : 'Clinical Document'}</title>
<style>
  @page { size: Letter; margin: .48in; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; color:#17243a; margin:0; background:#fff; font-size:11px; line-height:1.4; }
  .brand { display:flex; align-items:flex-start; justify-content:space-between; gap:20px; padding-bottom:12px; border-bottom:3px solid #176b54; }
  .brand h1 { margin:0; color:#12324b; font-size:20px; letter-spacing:-.02em; }
  .brand .doc-title { margin-top:3px; color:#176b54; font-weight:700; font-size:12px; text-transform:uppercase; letter-spacing:.08em; }
  .generated { text-align:right; color:#617184; font-size:9px; }
  .patient-card { display:grid; grid-template-columns:2fr 1fr 1fr; gap:10px; margin:14px 0 18px; padding:11px 13px; border:1px solid #d8e1e7; border-radius:8px; background:#f8fbfa; }
  .patient-card span { display:block; color:#68798a; font-size:8px; text-transform:uppercase; letter-spacing:.08em; }
  .patient-card strong { display:block; margin-top:2px; color:#142d45; font-size:11px; }
  .section { margin:0 0 18px; page-break-inside:auto; }
  .section-title { margin:0 0 8px; padding:7px 9px; border-left:4px solid #176b54; background:#eef7f3; color:#14344d; font-size:13px; }
  .record { margin:0 0 9px; padding:9px 10px; border:1px solid #e0e6eb; border-radius:7px; page-break-inside:avoid; }
  .record + .record { margin-top:8px; }
  .record-meta { display:flex; justify-content:space-between; gap:8px; margin-bottom:5px; color:#718090; font-size:8px; }
  dl { margin:0; }
  .row { display:grid; grid-template-columns:165px 1fr; gap:10px; padding:3px 0; border-bottom:1px solid #eef2f4; }
  .row:last-child { border-bottom:0; }
  dt { font-weight:650; color:#35495c; }
  dd { margin:0; white-space:pre-wrap; overflow-wrap:anywhere; }
  .empty { color:#7a8793; font-style:italic; }
  .footer { margin-top:18px; padding-top:8px; border-top:1px solid #d8e1e7; color:#6f7d89; font-size:8px; display:flex; justify-content:space-between; gap:12px; }
  .confidential { font-weight:700; color:#4d5f6f; }
  @media print { body { print-color-adjust:exact; -webkit-print-color-adjust:exact; } }
</style>
</head>
<body>
  <header class="brand">
    <div>
      <h1>${this.escape(orgName)}</h1>
      <div class="doc-title">${packetMode ? 'Clinical Visit Packet' : this.escape(this.kindTitle(kinds[0]))}</div>
    </div>
    <div class="generated">Generated<br><strong>${this.escape(generatedAt.toLocaleString())}</strong></div>
  </header>

  <section class="patient-card">
    <div><span>Patient</span><strong>${this.escape(patientName)}</strong></div>
    <div><span>MRN</span><strong>${this.escape(mrn)}</strong></div>
    <div><span>Date of birth</span><strong>${this.escape(dob || '—')}</strong></div>
  </section>

  ${sections.map((section) => this.renderSection(section)).join('')}

  <footer class="footer">
    <div><span class="confidential">CONFIDENTIAL CLINICAL RECORD</span><br>Use only for authorized treatment, payment, or healthcare operations.</div>
    <div>WoundApp clinical document</div>
  </footer>
</body>
</html>`;
  }

  private collectionPath(patientId: string, kind: ClinicalDocumentKind): string {
    const paths: Record<ClinicalDocumentKind, string> = {
      visit: `patients/${patientId}/woundVisits`,
      assessment: `patients/${patientId}/assessments`,
      braden: `patients/${patientId}/assessments`,
      systemic: `patients/${patientId}/assessments`,
      carePlan: `patients/${patientId}/carePlans`,
      order: `patients/${patientId}/orders`,
      education: `patients/${patientId}/educationRecords`,
      woundAssessment: `patients/${patientId}/woundAssessments`,
      progressNote: `patients/${patientId}/providerNotes`,
    };
    return paths[kind];
  }

  private async collectSourceRefs(
    patientId: string,
    kinds: ClinicalDocumentKind[],
    recordIds: Partial<Record<ClinicalDocumentKind, string>>,
    packetMode: boolean,
  ): Promise<Array<{ path: string; id: string }>> {
    const refs: Array<{ path: string; id: string }> = [];
    for (const kind of kinds) {
      const section = await this.loadSection(patientId, kind, recordIds[kind], packetMode);
      const path = this.collectionPath(patientId, kind);
      for (const record of section.records) refs.push({ path, id: record.id });
    }
    return refs;
  }

  private async readOrganization(orgId: string): Promise<any> {
    try {
      const snap = await getDoc(doc(db, 'organizations', orgId));
      return snap.exists() ? snap.data() : {};
    } catch {
      return {};
    }
  }

  private async loadSection(
    patientId: string,
    kind: ClinicalDocumentKind,
    recordId?: string,
    packetMode = false,
  ): Promise<ClinicalPacketSection> {
    const config: Record<ClinicalDocumentKind, { title: string; path: string; filter?: (d: any) => boolean }> = {
      visit: { title: 'Visit / EVV', path: `patients/${patientId}/woundVisits` },
      assessment: { title: 'Patient Assessment', path: `patients/${patientId}/assessments`, filter: (d) => d.kind !== 'braden' && d.kind !== 'systemic_assessment' },
      braden: { title: 'Braden Risk Assessment', path: `patients/${patientId}/assessments`, filter: (d) => d.kind === 'braden' },
      systemic: { title: 'Physical / Systemic Assessment', path: `patients/${patientId}/assessments`, filter: (d) => d.kind === 'systemic_assessment' },
      carePlan: { title: 'Care Plan', path: `patients/${patientId}/carePlans` },
      order: { title: 'Provider Orders', path: `patients/${patientId}/orders` },
      education: { title: 'Patient / Caregiver Education', path: `patients/${patientId}/educationRecords` },
      woundAssessment: { title: 'Wound Assessment', path: `patients/${patientId}/woundAssessments` },
      progressNote: { title: 'Progress Note', path: `patients/${patientId}/providerNotes` },
    };

    const cfg = config[kind];
    const snap = await getDocs(collection(db, cfg.path));
    let rows = snap.docs.map((entry) => ({ id: entry.id, data: entry.data() as any }));
    if (cfg.filter) rows = rows.filter((row) => cfg.filter!(row.data));
    if (recordId) rows = rows.filter((row) => row.id === recordId);
    rows.sort((a, b) => this.dateMillis(b.data) - this.dateMillis(a.data));

    if (!recordId && !packetMode && rows.length > 1) {
      rows = [rows[0]];
    }
    if (packetMode) {
      const today = new Date();
      const sameDay = rows.filter((row) => {
        const d = this.recordDate(row.data);
        return d && d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
      });
      if (sameDay.length) rows = sameDay;
      else if (['carePlan','order'].includes(kind) && rows.length) rows = [rows[0]];
      else rows = [];
    }

    return { kind, title: cfg.title, records: rows };
  }

  private renderSection(section: ClinicalPacketSection): string {
    return `<section class="section">
      <h2 class="section-title">${this.escape(section.title)}</h2>
      ${section.records.map((record) => {
        const when = this.recordDate(record.data);
        const author = this.authorLabel(record.data);
        return `<div class="record">
          <div class="record-meta">
            <span>${this.escape(when ? when.toLocaleString() : '')}</span>
            <span>${this.escape(author)}</span>
          </div>
          <dl>${this.renderObject(record.data)}</dl>
        </div>`;
      }).join('')}
    </section>`;
  }

  private renderObject(value: any, prefix = ''): string {
    if (!value || typeof value !== 'object') return '';
    const rows: string[] = [];

    Object.keys(value).sort().forEach((key) => {
      if (this.shouldHideKey(key)) return;
      const current = value[key];
      if (current === undefined || current === null || current === '') return;

      // Identity objects are clinically useful only for human-readable
      // name/credentials, never backend UID or tenant identifiers.
      if (this.looksLikeIdentity(current)) {
        const label = prefix ? `${prefix} › ${key}` : key;
        const identityText = [current.displayName, current.credentials].filter(Boolean).join(', ');
        if (identityText) rows.push(this.row(label, identityText));
        return;
      }

      const label = prefix ? `${prefix} › ${key}` : key;
      if (this.isTimestamp(current)) {
        rows.push(this.row(label, this.toDate(current)?.toLocaleString() || ''));
      } else if (Array.isArray(current)) {
        if (!current.length) return;
        const primitive = current.every((item) => item === null || ['string','number','boolean'].includes(typeof item));
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

    return rows.join('') || '<div class="empty">No additional printable fields.</div>';
  }

  private shouldHideKey(key: string): boolean {
    const k = key.toLowerCase();
    if (k === 'mrn') return false;
    if (k.endsWith('id') || k.endsWith('ids') || k.includes('uid')) return true;
    return [
      'createdby','updatedby','schemaVersion','workflow','sourceRefs','storagePath',
      'downloadURL','photoURL','client','immutable','hash','sha256','identityVersion',
      'capturedAtIso','source','facilityIds','roles'
    ].some((blocked) => k === blocked.toLowerCase());
  }

  private looksLikeIdentity(value: any): boolean {
    return !!value && typeof value === 'object' && ('displayName' in value) && ('uid' in value || 'credentials' in value || 'role' in value);
  }

  private authorLabel(data: any): string {
    const actor = data.authorIdentity || data.orderedBy || data.deliveredBy || data.finalizedBy || data.createdBy;
    if (actor && typeof actor === 'object') {
      return [actor.displayName, actor.credentials].filter(Boolean).join(', ');
    }
    return data.providerName || data.recordedByName || '';
  }

  private row(label: string, value: string): string {
    return `<div class="row"><dt>${this.escape(this.prettyLabel(label))}</dt><dd>${this.escape(value)}</dd></div>`;
  }

  private prettyLabel(value: string): string {
    const aliases: Record<string, string> = {
      'orderedAt': 'Order date',
      'effectiveAt': 'Effective date',
      'assessedAt': 'Assessment date',
      'deliveredAt': 'Education date',
      'orderType': 'Order type',
      'reasonForAdmission': 'Reason for visit',
      'readBackConfirmed': 'Read-back confirmed',
      'receiptMethod': 'Order received by',
    };
    const last = value.split(' › ').pop() || value;
    const prettyLast = aliases[last] || last.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
    if (!value.includes(' › ')) return prettyLast;
    const parent = value.split(' › ').slice(0, -1).map((part) => part.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ')).join(' › ');
    return `${parent} › ${prettyLast}`;
  }

  private recordDate(data: any): Date | null {
    for (const key of ['effectiveAt','assessedAt','deliveredAt','orderedAt','completedAt','checkOut','checkIn','createdAt','updatedAt','scheduledFor']) {
      const value = data?.[key];
      if (value && typeof value === 'object' && value.at) {
        const nested = this.toDate(value.at);
        if (nested) return nested;
      }
      const date = this.toDate(value);
      if (date) return date;
    }
    return null;
  }

  private dateMillis(data: any): number {
    return this.recordDate(data)?.getTime() || 0;
  }

  private displayDate(value: any): string {
    const d = this.toDate(value);
    return d ? d.toLocaleDateString() : (typeof value === 'string' ? value : '');
  }

  private isTimestamp(value: any): boolean {
    return !!value && typeof value === 'object' && (typeof value.toDate === 'function' || typeof value.seconds === 'number');
  }

  private toDate(value: any): Date | null {
    if (!value) return null;
    if (typeof value?.toDate === 'function') return value.toDate();
    if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
    if (value instanceof Date) return value;
    if (typeof value === 'string' || typeof value === 'number') {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
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
      systemic: 'Physical / Systemic Assessment',
      carePlan: 'Care Plan',
      order: 'Clinical Order',
      education: 'Patient Education',
      woundAssessment: 'Wound Assessment',
      progressNote: 'Progress Note',
    };
    return titles[kind];
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
