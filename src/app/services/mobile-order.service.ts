import { Injectable, inject } from '@angular/core';
import { collection, doc, getDocs, query, serverTimestamp, setDoc, Timestamp, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { TenantService } from './tenant.service';
import { ClinicalIdentityService, ClinicalIdentitySnapshot } from './clinical-identity.service';
import { ClinicalAuditService } from './clinical-audit.service';
import { MobileAlgorithmGuidance, MobileWoundGuidanceInput } from '../shared/mobile-order-guidance';
import { ClinicalVisitLink, clinicalVisitLinkFields } from '../shared/clinical-visit-link';

export interface MobileCareAlgorithmStep {
  id?: string;
  sequence?: number;
  instruction: string;
  woundCleanser?: string | null;
  applyToWoundProduct?: string | null;
  coverMethod?: string | null;
  frequency?: string | null;
  appliesWhen?: string | null;
  notes?: string | null;
}

export interface MobileCareAlgorithm {
  id: string;
  orgId: string;
  woundType: string;
  name: string;
  description?: string | null;
  steps: MobileCareAlgorithmStep[];
  contingencies?: Array<{ trigger: string; action: string }>;
  active: boolean;
  version?: number;
}

export interface MobileTreatmentProtocolOption {
  id: string;
  label: string;
  required?: boolean;
  selectedByDefault?: boolean;
  requiresComment?: boolean;
  order?: number;
}

export interface MobileTreatmentProtocolSections {
  specialInstructions?: MobileTreatmentProtocolOption[];
  cleanse: MobileTreatmentProtocolOption[];
  prep: MobileTreatmentProtocolOption[];
  fillApply: MobileTreatmentProtocolOption[];
  cover: MobileTreatmentProtocolOption[];
  secureWith: MobileTreatmentProtocolOption[];
  changePrn: MobileTreatmentProtocolOption[];
}

export interface MobileTreatmentProtocolTemplate {
  id: string;
  orgId: string;
  name: string;
  category: string;
  description?: string | null;
  active: boolean;
  version: number;
  orderDefaults: {
    priority?: string | null;
    frequency?: string | null;
    durationMode?: string | null;
    durationValue?: number | null;
    woundManagement?: string | null;
  };
  sections: MobileTreatmentProtocolSections;
}

export interface MobileAppliedTreatmentProtocol {
  templateId: string;
  templateName: string;
  templateCategory: string;
  templateVersion: number;
  snapshot: {
    templateId: string;
    name: string;
    category: string;
    version: number;
    description?: string | null;
    orderDefaults: MobileTreatmentProtocolTemplate['orderDefaults'];
    sections: MobileTreatmentProtocolSections;
  };
}

export interface MobilePrescriber {
  uid: string;
  displayName: string;
  role: string;
  credentials?: string | null;
  npi?: string | null;
}

export interface MobileWoundOption {
  woundId: string;
  label: string;
  guidanceInput: MobileWoundGuidanceInput;
}

export type MobileOrderReceiptMethod = 'direct' | 'telephone' | 'verbal';

@Injectable({ providedIn: 'root' })
export class MobileOrderService {
  private tenant = inject(TenantService);
  private identity = inject(ClinicalIdentityService);
  private audit = inject(ClinicalAuditService);

  async listPublishedAlgorithms(): Promise<MobileCareAlgorithm[]> {
    const orgId = await this.tenant.currentOrgId();
    if (!orgId) return [];
    const snap = await getDocs(collection(db, `organizations/${orgId}/careAlgorithms`));
    return snap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) } as MobileCareAlgorithm))
      .filter(a => a.orgId === orgId && a.active === true && Array.isArray(a.steps) && a.steps.some(step => !!step?.instruction?.trim()))
      .sort((a, b) => (a.woundType || '').localeCompare(b.woundType || '') || a.name.localeCompare(b.name));
  }

  async listPublishedTreatmentProtocols(): Promise<MobileTreatmentProtocolTemplate[]> {
    const orgId = await this.tenant.currentOrgId();
    if (!orgId) return [];
    const snap = await getDocs(collection(db, `organizations/${orgId}/treatmentProtocolTemplates`));
    return snap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) } as MobileTreatmentProtocolTemplate))
      .filter(t => t.orgId === orgId && t.active === true && !((t as any).archivedAt))
      .sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name));
  }

  treatmentCategoryForWoundType(woundType: string): string | null {
    if (['arterial', 'neuropathic', 'arterial_neuropathic'].includes(woundType)) return 'arterial_neuropathic';
    if (['wet', 'dry', 'wet_necrotic', 'dry_necrotic', 'venous', 'skin_tear', 'compression'].includes(woundType)) return woundType;
    return null;
  }

  snapshotTreatmentProtocol(template: MobileTreatmentProtocolTemplate): MobileAppliedTreatmentProtocol {
    return {
      templateId: template.id,
      templateName: template.name,
      templateCategory: template.category,
      templateVersion: template.version || 1,
      snapshot: {
        templateId: template.id,
        name: template.name,
        category: template.category,
        version: template.version || 1,
        description: template.description ?? null,
        orderDefaults: JSON.parse(JSON.stringify(template.orderDefaults || {})),
        sections: JSON.parse(JSON.stringify(template.sections || {})),
      },
    };
  }

  async listPrescribers(): Promise<MobilePrescriber[]> {
    const orgId = await this.tenant.currentOrgId();
    if (!orgId) return [];
    const snap = await getDocs(query(collection(db, 'staffPublic'), where('orgId', '==', orgId)));
    return snap.docs
      .map(d => ({ uid: d.id, ...(d.data() as any) }))
      .filter((s: any) => s.orgId === orgId && s.active !== false && ['provider', 'np'].includes(String(s.role || '').toLowerCase()) && !!String(s.displayName || '').trim())
      .map((s: any) => ({ uid: s.uid || s.id, displayName: String(s.displayName).trim(), role: String(s.role || ''), credentials: s.credentials || null, npi: s.npi || null }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  async listWounds(patientId: string): Promise<MobileWoundOption[]> {
    const snap = await getDocs(collection(db, `patients/${patientId}/woundAssessments`));
    const byWound = new Map<string, any>();
    for (const d of snap.docs) {
      const data: any = d.data();
      const woundId = data.woundId || d.id;
      const existing = byWound.get(woundId);
      const at = this.toMillis(data.assessedAt || data.createdAt);
      if (!existing || at >= existing.at) byWound.set(woundId, { id: woundId, data, at });
    }
    return Array.from(byWound.values()).map(item => {
      const data = item.data;
      const type = data.describe?.type || data.type || 'Wound';
      const location = data.describe?.location || data.location || '';
      return {
        woundId: item.id,
        label: location ? `${type} — ${location}` : type,
        guidanceInput: {
          woundType: type,
          exudateAmount: data.exudate?.amount ?? null,
          sloughPresent: data.woundBed?.slough?.present === true,
          escharPresent: data.woundBed?.eschar === true,
          infectionFindings: Array.isArray(data.woundBed?.infection) ? data.woundBed.infection : [],
          infectionStatus: data.progress?.infection ?? null,
        },
      };
    }).sort((a, b) => a.label.localeCompare(b.label));
  }

  renderAlgorithm(algorithm: MobileCareAlgorithm): string {
    const steps = [...(algorithm.steps || [])]
      .filter(s => !!s?.instruction?.trim())
      .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
    if (!steps.length) return '';
    const lines = steps.map((step, index) => {
      const details = [
        step.appliesWhen ? `when ${step.appliesWhen}` : null,
        step.woundCleanser ? `cleanser: ${step.woundCleanser}` : null,
        step.applyToWoundProduct ? `apply: ${step.applyToWoundProduct}` : null,
        step.coverMethod ? `cover: ${step.coverMethod}` : null,
        step.frequency ? `frequency: ${step.frequency}` : null,
      ].filter(Boolean);
      return `${index + 1}. ${step.instruction.trim()}${details.length ? ` (${details.join('; ')})` : ''}`;
    });
    const contingencies = (algorithm.contingencies || [])
      .filter(c => !!c?.trigger?.trim() && !!c?.action?.trim())
      .map(c => `${c.trigger.trim()}: ${c.action.trim()}`);
    return [algorithm.name, ...lines, ...contingencies].join('\n');
  }

  async createAlgorithmOrder(patientId: string, input: {
    algorithm: MobileCareAlgorithm;
    woundId?: string | null;
    woundLabel?: string | null;
    receiptMethod: MobileOrderReceiptMethod;
    prescriberUid?: string | null;
    readBackConfirmed?: boolean;
    guidance?: MobileAlgorithmGuidance | null;
    selectedTypeMatchedGuidance?: boolean;
    treatmentProtocol?: MobileTreatmentProtocolTemplate | null;
    treatmentSelections?: Partial<Record<keyof MobileTreatmentProtocolSections, string[]>>;
    visitLink?: ClinicalVisitLink | null;
  }): Promise<string> {
    if (!patientId) throw new Error('Patient is required.');
    const user = auth.currentUser;
    if (!user) throw new Error('Sign in required.');
    const actor = await this.identity.requireCurrentIdentity();
    this.assertClinicalAuthor(actor);
    const orgId = await this.tenant.currentOrgId();
    if (!orgId || input.algorithm.orgId !== orgId || !input.algorithm.active) throw new Error('This algorithm is not published for your organization.');

    const description = this.renderAlgorithm(input.algorithm);
    if (!description) throw new Error('This algorithm has no orderable steps.');

    const isPrescriber = ['provider', 'np'].includes(actor.role.toLowerCase());
    let receiptMethod: MobileOrderReceiptMethod = input.receiptMethod;
    let coSignature: any = null;

    if (isPrescriber) {
      receiptMethod = 'direct';
    } else {
      if (!['telephone', 'verbal'].includes(receiptMethod)) throw new Error('Nursing staff must record how the prescriber order was received.');
      if (!input.readBackConfirmed) throw new Error('Confirm read-back before recording a telephone or verbal order.');
      const prescribers = await this.listPrescribers();
      const prescriber = prescribers.find(p => p.uid === input.prescriberUid);
      if (!prescriber) throw new Error('Select the prescriber who gave the order.');
      coSignature = {
        status: 'pending',
        provider: { uid: prescriber.uid, displayName: prescriber.displayName, role: prescriber.role, credentials: prescriber.credentials || null, npi: prescriber.npi || null },
        requestedAt: Timestamp.now(),
        signedAt: null,
        signedBy: null,
      };
    }

    const ref = doc(collection(db, `patients/${patientId}/orders`));
    const now = serverTimestamp();
    const treatment = input.treatmentProtocol || null;
    if (treatment && (treatment.orgId !== orgId || treatment.active !== true)) {
      throw new Error('This treatment protocol is not published for your organization.');
    }
    const selections = input.treatmentSelections || {};
    const treatmentLines = treatment ? [
      `Treatment template: ${treatment.name} (v${treatment.version || 1})`,
      selections.cleanse?.length ? `Cleanse: ${selections.cleanse.join(', ')}` : null,
      selections.prep?.length ? `Prep/periwound: ${selections.prep.join(', ')}` : null,
      selections.fillApply?.length ? `Fill/apply: ${selections.fillApply.join(', ')}` : null,
      selections.cover?.length ? `Cover: ${selections.cover.join(', ')}` : null,
      selections.secureWith?.length ? `Secure: ${selections.secureWith.join(', ')}` : null,
      selections.changePrn?.length ? `Change/PRN: ${selections.changePrn.join(', ')}` : null,
      treatment.orderDefaults?.frequency ? `Frequency: ${treatment.orderDefaults.frequency}` : null,
    ].filter((line): line is string => !!line) : [];
    const descriptionWithWound = [
      input.woundLabel ? `Wound: ${input.woundLabel}` : null,
      description,
      ...treatmentLines,
    ].filter((line): line is string => !!line).join('\n');
    await setDoc(ref, {
      orgId,
      patientId,
      ...clinicalVisitLinkFields({
        ...(input.visitLink || {}),
        woundId: input.woundId || input.visitLink?.woundId || null,
      }),
      woundId: input.woundId || input.visitLink?.woundId || null,
      episodeId: input.visitLink?.episodeId || null,
      facilityId: null,
      orderType: 'wound_care_algorithm',
      description: descriptionWithWound,
      orderedAt: now,
      orderedBy: actor,
      receiptMethod,
      readBackConfirmed: receiptMethod === 'direct' ? null : true,
      coSignature,
      algorithmId: input.algorithm.id,
      algorithmName: input.algorithm.name,
      algorithmWoundType: input.algorithm.woundType,
      algorithmVersion: input.algorithm.version ?? 1,
      schemaVersion: treatment ? 3 : 2,
      generatedOrderText: treatmentLines.join(' '),
      treatmentProtocol: treatment ? this.snapshotTreatmentProtocol(treatment) : null,
      source: {
        mode: 'algorithm',
        algorithmId: input.algorithm.id,
        algorithmName: input.algorithm.name,
        algorithmVersion: input.algorithm.version ?? 1,
        guidance: input.guidance ? {
          suggestedWoundTypes: input.guidance.suggestedTypes,
          rationale: input.guidance.rationale,
          cautions: input.guidance.cautions,
          selectedTypeMatchedGuidance: input.selectedTypeMatchedGuidance === true,
        } : null,
      },
      clinical: {
        woundType: input.algorithm.woundType,
        woundLocation: input.woundLabel ?? null,
        woundManagement: treatment?.orderDefaults?.woundManagement ?? null,
        specialInstructions: selections.specialInstructions || [],
        schedule: {
          frequency: treatment?.orderDefaults?.frequency ??
            (input.algorithm.steps || []).map(step => step.frequency).find(value => !!value) ?? null,
          prn: selections.changePrn || [],
        },
        cleanse: selections.cleanse?.length
          ? selections.cleanse
          : (input.algorithm.steps || []).map(step => step.woundCleanser).filter((value): value is string => !!value),
        prep: selections.prep || [],
        apply: selections.fillApply?.length
          ? selections.fillApply
          : (input.algorithm.steps || []).map(step => step.applyToWoundProduct).filter((value): value is string => !!value),
        cover: selections.cover?.length
          ? selections.cover
          : (input.algorithm.steps || []).map(step => step.coverMethod).filter((value): value is string => !!value),
        secure: selections.secureWith || [],
        contingencies: (input.algorithm.contingencies || []).map(entry => ({
          trigger: entry.trigger,
          action: entry.action,
        })),
      },
      workflow: { state: 'created', history: [{ fromState: null, toState: 'created', occurredAt: Timestamp.now(), actor, comment: 'Order placed from published organization algorithm in mobile field workflow.' }] },
      createdAt: now,
      updatedAt: now,
      createdBy: actor,
      updatedBy: actor,
    });
    await this.audit.record({ action: 'order_created', patientId, entityType: 'order', entityId: ref.id, metadata: {
      receiptMethod,
      algorithmVersion: input.algorithm.version ?? 1,
      treatmentTemplateId: treatment?.id ?? null,
      treatmentTemplateVersion: treatment?.version ?? null,
    } });
    return ref.id;
  }

  private assertClinicalAuthor(identity: ClinicalIdentitySnapshot): void {
    const roles = new Set([identity.role, ...(identity.roles || [])].map(r => String(r || '').toLowerCase()));
    if (![...roles].some(r => ['provider', 'np', 'nurse', 'rn', 'wound_nurse_internal'].includes(r))) {
      throw new Error('Your role cannot author patient orders in the mobile clinical workspace.');
    }
  }

  private toMillis(value: any): number {
    if (!value) return 0;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  }
}
