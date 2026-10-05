import { Injectable, inject } from '@angular/core';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { TenantService } from './tenant.service';

export interface ClinicalAuditEventInput {
  action: string;
  patientId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  route?: string | null;
  outcome?: 'success' | 'failure';
  reasonCode?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
}

@Injectable({ providedIn: 'root' })
export class ClinicalAuditService {
  private tenant = inject(TenantService);

  async record(input: ClinicalAuditEventInput): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    const orgId = await this.tenant.currentOrgId();
    if (!orgId) return;

    const safeMetadata = this.sanitizeMetadata(input.metadata || {});
    await addDoc(collection(db, 'clinicalAuditEvents'), {
      orgId,
      actorUid: user.uid,
      action: input.action,
      patientId: input.patientId || null,
      entityType: input.entityType || null,
      entityId: input.entityId || null,
      route: input.route || null,
      outcome: input.outcome || 'success',
      reasonCode: input.reasonCode || null,
      metadata: safeMetadata,
      occurredAt: serverTimestamp(),
      client: {
        platform: 'woundapp',
        userAgentFamily: this.userAgentFamily(),
      },
    });
  }

  private sanitizeMetadata(source: Record<string, string | number | boolean | null>): Record<string, string | number | boolean | null> {
    const blocked = ['name', 'dob', 'address', 'phone', 'email', 'diagnosis', 'details', 'description', 'notes', 'photo', 'content'];
    const result: Record<string, string | number | boolean | null> = {};
    for (const [key, value] of Object.entries(source)) {
      if (blocked.some((term) => key.toLowerCase().includes(term))) continue;
      if (typeof value === 'string' && value.length > 120) result[key] = value.slice(0, 120);
      else result[key] = value;
    }
    return result;
  }

  private userAgentFamily(): string {
    const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
    if (/iphone|ipad|ipod/i.test(ua)) return 'ios-web';
    if (/android/i.test(ua)) return 'android-web';
    return 'web';
  }
}
