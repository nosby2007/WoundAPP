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

  async printVisitPacket(patientId: string): Promise<void> {
    const html = await this.buildDocument(patientId, [
      'visit',
      'assessment',
      'braden',
      'systemic',
      'carePlan',
      'order',
      'education',
      'woundAssessment',
      'progressNote',
    ]);
    await this.audit.record({ action: 'visit_packet_printed', patientId, entityType: 'visitPacket' });
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

  async shareVisitPacket(patientId: string): Promise<'shared' | 'print'> {
    const html = await this.buildDocument(patientId, [
      'visit',
      'assessment',
      'braden',
      'systemic',
      'carePlan',
      'order',
      'education',
      'woundAssessment',
      'progressNote',
    ]);
    const snapshot = await this.snapshots.finalize({
      patientId,
      kind: 'visitPacket',
      title: 'Visit Packet',
      html,
      sourceRefs: [],
    });
    const filename = `visit-packet-${new Date().toISOString().slice(0, 10)}.html`;
    const blob = new Blob([html], { type: 'text/html' });
    const file = new File([blob], filename, { type: 'text/html' });
    const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };

    if (navigator.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
      await navigator.share({
        title: 'Visit Packet',
        text: 'Clinical visit packet. Send only through an approved secure destination.',
        files: [file],
      });
      await this.audit.record({ action: 'visit_packet_shared', patientId, entityType: 'documentSnapshot', entityId: snapshot.id });
      return 'shared';
    }

    this.openPrintWindow(html);
    return 'print';
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
