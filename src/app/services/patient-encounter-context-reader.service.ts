import { Injectable } from '@angular/core';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export interface EncounterContextItem {
  id: string;
  label: string;
  detail: string;
  source: string | null;
}

export interface EncounterContext {
  medications: EncounterContextItem[];
  activeOrders: EncounterContextItem[];
  vascular: EncounterContextItem[];
  systemic: EncounterContextItem[];
}

@Injectable({ providedIn: 'root' })
export class PatientEncounterContextReaderService {
  async load(patientId: string): Promise<EncounterContext> {
    if (!patientId) throw new Error('Patient context requires a patientId.');
    const [medications, activeOrders, vascular, systemic] = await Promise.all([
      this.safe(() => this.medications(patientId)),
      this.safe(() => this.orders(patientId)),
      this.safe(() => this.vascular(patientId)),
      this.safe(() => this.systemic(patientId)),
    ]);
    return { medications, activeOrders, vascular, systemic };
  }

  private async medications(patientId: string): Promise<EncounterContextItem[]> {
    const snapshot = await getDocs(collection(db, `patients/${patientId}/prescriptions`));
    const now = Date.now();
    return snapshot.docs
      .map((document) => ({ id: document.id, ...(document.data() as any) }))
      .filter((row) => {
        if (row.discontinued === true) return false;
        if (['discontinued','cancelled','completed','void'].includes(String(row.status || '').toLowerCase())) return false;
        const end = this.millis(row.endDate);
        return !end || end >= now;
      })
      .map((row) => ({
        id: row.id,
        label: this.text(row.name || row.medication) || 'Medication',
        detail: [row.dose, row.route, row.frequency].filter(Boolean).join(' · '),
        source: this.text(row.prescriber || row.prescriberName),
      }));
  }

  private async orders(patientId: string): Promise<EncounterContextItem[]> {
    const snapshot = await getDocs(collection(db, `patients/${patientId}/orders`));
    return snapshot.docs
      .map((document) => ({ id: document.id, ...(document.data() as any) }))
      .filter((row) =>
        !row.archivedAt &&
        !['completed','cancelled','discontinued','void'].includes(String(row.status || '').toLowerCase())
      )
      .map((row) => ({
        id: row.id,
        label: this.text(row.orderType || row.title || row.orderName) || 'Active order',
        detail: this.text(row.generatedOrderText || row.description || row.instructions) || 'Order details recorded in chart',
        source: this.text(row.orderedBy?.displayName || row.orderedByName || row.providerName),
      }));
  }

  private async vascular(patientId: string): Promise<EncounterContextItem[]> {
    const snapshot = await getDocs(collection(db, `patients/${patientId}/vascularAssessments`));
    return snapshot.docs
      .map((document) => ({ id: document.id, ...(document.data() as any) }))
      .sort((a, b) => this.millis(b.assessedAt || b.createdAt) - this.millis(a.assessedAt || a.createdAt))
      .slice(0, 2)
      .map((row) => {
        const dp = row.pulses?.dorsalisPedis;
        const pt = row.pulses?.posteriorTibial;
        const parts = [
          dp ? `DP L:${dp.left || '—'} R:${dp.right || '—'}` : null,
          pt ? `PT L:${pt.left || '—'} R:${pt.right || '—'}` : null,
          row.capillaryRefill ? `Capillary refill: ${row.capillaryRefill}` : null,
          row.edema ? `Edema: ${row.edema}` : null,
          row.skinTemperature ? `Temperature: ${row.skinTemperature}` : null,
          this.text(row.notes),
        ].filter(Boolean);
        return {
          id: row.id,
          label: 'Vascular assessment',
          detail: parts.join(' · ') || 'Vascular assessment recorded',
          source: this.text(row.assessedBy?.displayName),
        };
      });
  }

  private async systemic(patientId: string): Promise<EncounterContextItem[]> {
    const snapshot = await getDocs(collection(db, `patients/${patientId}/assessments`));
    return snapshot.docs
      .map((document) => ({ id: document.id, ...(document.data() as any) }))
      .filter((row) => row.kind === 'systemic_assessment' || row.type === 'systemic_assessment' || row.program === 'Systemic')
      .sort((a, b) => this.millis(b.assessedAt || b.createdAt) - this.millis(a.assessedAt || a.createdAt))
      .slice(0, 2)
      .map((row) => {
        const summary = this.text(row.answers?.clinicalSummary);
        const systems = Object.entries(row.answers?.systems || {})
          .filter(([, value]) => typeof value === 'string' && value.trim())
          .slice(0, 5)
          .map(([key, value]) => `${this.label(key)}: ${String(value).trim()}`)
          .join(' · ');
        return {
          id: row.id,
          label: 'Systemic assessment',
          detail: summary || systems || 'Systemic assessment recorded',
          source: this.text(row.recordedByName || row.authorIdentity?.displayName),
        };
      });
  }

  private async safe(reader: () => Promise<EncounterContextItem[]>): Promise<EncounterContextItem[]> {
    try {
      return await reader();
    } catch {
      return [];
    }
  }

  private text(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private millis(value: any): number {
    if (!value) return 0;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  private label(value: string): string {
    return value.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase()).trim();
  }
}