import { Injectable, inject } from '@angular/core';
import { collection, doc, getDocs, query, serverTimestamp, setDoc, Timestamp, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { TenantService } from './tenant.service';
import { ClinicalIdentityService, ClinicalIdentitySnapshot } from './clinical-identity.service';
import { ClinicalAuditService } from './clinical-audit.service';
import { MobileAlgorithmGuidance, MobileWoundGuidanceInput } from '../shared/mobile-order-guidance';
import { ClinicalVisitLink, clinicalVisitLinkFields } from '../shared/clinical-visit-link';

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

export interface MobileTreatmentRoutine {
  woundManagement: string | null;
  specialInstructions: string[];
  cleanse: string[];
  prep: string[];
  fillApply: string[];
  cover: string[];
  secureWith: string[];
  frequency: string | null;
  startDate: string | null;
  duration: string | null;
  changePrn: string[];
  comments: string | null;
}

export type MobileOrderReceiptMethod = 'direct' | 'telephone' | 'verbal';

@Injectable({ providedIn: 'root' })
export class MobileOrderService {
  private tenant = inject(TenantService);
  private identity = inject(ClinicalIdentityService);
  private audit = inject(ClinicalAuditService);

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

  async createTreatmentProtocolOrder(patientId: string, input: {
    treatmentProtocol: MobileTreatmentProtocolTemplate;
    woundId?: string | null;
    woundLabel?: string | null;
    selectedCategory: string;
    receiptMethod: MobileOrderReceiptMethod;
    prescriberUid?: string | null;
    readBackConfirmed?: boolean;
    guidance?: MobileAlgorithmGuidance | null;
    selectedTypeMatchedGuidance?: boolean;
    routine: MobileTreatmentRoutine;
    visitLink?: ClinicalVisitLink | null;
  }): Promise<string> {
    if (!patientId) throw new Error('Patient is required.');
    const user = auth.currentUser;
    if (!user) throw new Error('Sign in required.');

    const actor = await this.identity.requireCurrentIdentity();
    this.assertClinicalAuthor(actor);

    const orgId = await this.tenant.currentOrgId();
    const treatment = input.treatmentProtocol;
    if (!orgId || treatment.orgId !== orgId || treatment.active !== true) {
      throw new Error('This treatment protocol is not published for your organization.');
    }

    const mappedCategory = this.treatmentCategoryForWoundType(input.selectedCategory) || input.selectedCategory;
    if (mappedCategory && treatment.category !== mappedCategory) {
      throw new Error('Selected treatment protocol does not match the provider-selected wound category.');
    }

    const isPrescriber = ['provider', 'np'].includes(actor.role.toLowerCase());
    let receiptMethod: MobileOrderReceiptMethod = input.receiptMethod;
    let coSignature: any = null;

    if (isPrescriber) {
      receiptMethod = 'direct';
    } else {
      if (!['telephone', 'verbal'].includes(receiptMethod)) {
        throw new Error('Nursing staff must record how the prescriber order was received.');
      }
      if (!input.readBackConfirmed) {
        throw new Error('Confirm read-back before recording a telephone or verbal order.');
      }
      const prescribers = await this.listPrescribers();
      const prescriber = prescribers.find(p => p.uid === input.prescriberUid);
      if (!prescriber) throw new Error('Select the prescriber who gave the order.');
      coSignature = {
        status: 'pending',
        provider: {
          uid: prescriber.uid,
          displayName: prescriber.displayName,
          role: prescriber.role,
          credentials: prescriber.credentials || null,
          npi: prescriber.npi || null,
        },
        requestedAt: Timestamp.now(),
        signedAt: null,
        signedBy: null,
      };
    }

    const routine = input.routine;
    const startAt = routine.startDate
      ? Timestamp.fromDate(new Date(`${routine.startDate}T00:00:00`))
      : null;
    const treatmentLines = [
      `Treatment protocol: ${treatment.name} (v${treatment.version || 1})`,
      routine.woundManagement ? `Wound management: ${routine.woundManagement}` : null,
      routine.specialInstructions.length ? `Special instructions: ${routine.specialInstructions.join(', ')}` : null,
      routine.cleanse.length ? `Cleanse: ${routine.cleanse.join(', ')}` : null,
      routine.prep.length ? `Prep/periwound: ${routine.prep.join(', ')}` : null,
      routine.fillApply.length ? `Fill/apply: ${routine.fillApply.join(', ')}` : null,
      routine.cover.length ? `Cover: ${routine.cover.join(', ')}` : null,
      routine.secureWith.length ? `Secure: ${routine.secureWith.join(', ')}` : null,
      routine.frequency ? `Frequency: ${routine.frequency}` : null,
      routine.startDate ? `Start date: ${routine.startDate}` : null,
      routine.duration ? `Duration: ${routine.duration}` : null,
      routine.changePrn.length ? `Change/PRN: ${routine.changePrn.join(', ')}` : null,
      routine.comments ? `Provider comments: ${routine.comments}` : null,
    ].filter((line): line is string => !!line);

    const description = [
      input.woundLabel ? `Wound: ${input.woundLabel}` : null,
      ...treatmentLines,
    ].filter((line): line is string => !!line).join('\n');

    const ref = doc(collection(db, `patients/${patientId}/orders`));
    const now = serverTimestamp();

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
      orderType: 'wound_care_protocol',
      description,
      generatedOrderText: treatmentLines.join(' '),
      treatmentProtocol: this.snapshotTreatmentProtocol(treatment),
      orderedAt: now,
      orderedBy: actor,
      receiptMethod,
      readBackConfirmed: receiptMethod === 'direct' ? null : true,
      coSignature,
      schemaVersion: 3,
      source: {
        mode: 'treatment_protocol',
        guidance: input.guidance ? {
          suggestedWoundTypes: input.guidance.suggestedTypes,
          rationale: input.guidance.rationale,
          cautions: input.guidance.cautions,
          selectedTypeMatchedGuidance: input.selectedTypeMatchedGuidance === true,
        } : null,
      },
      clinical: {
        woundType: treatment.category,
        woundLocation: input.woundLabel ?? null,
        woundManagement: routine.woundManagement,
        specialInstructions: routine.specialInstructions,
        schedule: {
          frequency: routine.frequency,
          startAt,
          duration: routine.duration,
          prn: routine.changePrn,
        },
        cleanse: routine.cleanse,
        prep: routine.prep,
        apply: routine.fillApply,
        cover: routine.cover,
        secure: routine.secureWith,
        comments: routine.comments,
        contingencies: [],
      },
      workflow: {
        state: 'created',
        history: [{
          fromState: null,
          toState: 'created',
          occurredAt: Timestamp.now(),
          actor,
          comment: 'Order placed from admin-published treatment protocol in mobile field workflow.',
        }],
      },
      createdAt: now,
      updatedAt: now,
      createdBy: actor,
      updatedBy: actor,
    });

    await this.audit.record({
      action: 'order_created',
      patientId,
      entityType: 'order',
      entityId: ref.id,
      metadata: {
        receiptMethod,
        treatmentTemplateId: treatment.id,
        treatmentTemplateVersion: treatment.version ?? 1,
        treatmentCategory: treatment.category,
      },
    });
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
