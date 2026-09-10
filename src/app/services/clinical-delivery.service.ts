import { Injectable, inject } from '@angular/core';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { TenantService } from './tenant.service';
import { ClinicalAuditService } from './clinical-audit.service';

export type ClinicalDeliveryMethod = 'secure_email' | 'secure_fax';

export interface ClinicalDeliveryDraft {
  patientId: string;
  snapshotId: string;
  method: ClinicalDeliveryMethod;
  recipientType: 'provider' | 'facility' | 'case_manager' | 'referring_provider' | 'other';
  destinationLabel: string;
  destinationToken: string;
}

@Injectable({ providedIn: 'root' })
export class ClinicalDeliveryService {
  private tenant = inject(TenantService);
  private audit = inject(ClinicalAuditService);

  async queue(draft: ClinicalDeliveryDraft): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new Error('Sign in required.');
    const orgId = await this.tenant.currentOrgId();
    if (!orgId) throw new Error('Organization context unavailable.');

    const created = await addDoc(collection(db, 'clinicalDocumentDeliveries'), {
      orgId,
      patientId: draft.patientId,
      snapshotId: draft.snapshotId,
      method: draft.method,
      recipientType: draft.recipientType,
      destinationLabel: draft.destinationLabel,
      destinationToken: draft.destinationToken,
      status: 'queued',
      requestedByUid: user.uid,
      requestedAt: serverTimestamp(),
      attempts: 0,
      schemaVersion: 1,
    });
    await this.audit.record({
      action: 'document_delivery_queued',
      patientId: draft.patientId,
      entityType: 'clinicalDocumentDelivery',
      entityId: created.id,
      metadata: { method: draft.method, recipientType: draft.recipientType },
    });
    return created.id;
  }
}
