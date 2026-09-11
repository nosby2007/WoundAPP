import { Injectable, inject } from '@angular/core';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { TenantService } from './tenant.service';
import { ClinicalAuditService } from './clinical-audit.service';

export type ClinicalDeliveryMethod = 'secure_email' | 'secure_fax';
export type ClinicalRecipientType = 'provider' | 'facility' | 'case_manager' | 'referring_provider' | 'other';

export interface ClinicalDeliveryDraft {
  patientId: string;
  snapshotId: string;
  recipientId: string;
  method: ClinicalDeliveryMethod;
  recipientType: ClinicalRecipientType;
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

    // Client preflight mirrors, but never replaces, Firestore rules.
    const snapshotRef = doc(db, `patients/${draft.patientId}/documentSnapshots/${draft.snapshotId}`);
    const snapshot = await getDoc(snapshotRef);
    if (!snapshot.exists()) throw new Error('Finalized document snapshot not found.');
    const snapshotData: any = snapshot.data();
    if (snapshotData.orgId !== orgId || snapshotData.patientId !== draft.patientId || snapshotData.immutable !== true) {
      throw new Error('Snapshot is not valid for this organization/patient.');
    }

    const recipientRef = doc(db, `organizations/${orgId}/deliveryRecipients/${draft.recipientId}`);
    const recipient = await getDoc(recipientRef);
    if (!recipient.exists()) throw new Error('Approved recipient not found.');
    const recipientData: any = recipient.data();
    if (recipientData.orgId !== orgId || recipientData.active === false) {
      throw new Error('Approved recipient is inactive or outside this organization.');
    }

    const idempotencyKey = crypto.randomUUID();
    const deliveryId = idempotencyKey;
    await setDoc(doc(db, 'clinicalDocumentDeliveries', deliveryId), {
      orgId,
      patientId: draft.patientId,
      snapshotId: draft.snapshotId,
      recipientId: draft.recipientId,
      method: draft.method,
      recipientType: draft.recipientType,
      status: 'queued',
      requestedByUid: user.uid,
      requestedAt: serverTimestamp(),
      attempts: 0,
      idempotencyKey,
      schemaVersion: 2,
    });

    await this.audit.record({
      action: 'document_delivery_queued',
      patientId: draft.patientId,
      entityType: 'clinicalDocumentDelivery',
      entityId: deliveryId,
      metadata: { method: draft.method, recipientType: draft.recipientType },
    });
    return deliveryId;
  }
}
