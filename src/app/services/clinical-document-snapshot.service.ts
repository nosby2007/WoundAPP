import { Injectable, inject } from '@angular/core';
import { collection, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { ClinicalIdentityService } from './clinical-identity.service';
import { TenantService } from './tenant.service';
import { ClinicalAuditService } from './clinical-audit.service';

export interface ClinicalDocumentSnapshotInput {
  patientId: string;
  kind: string;
  title: string;
  html: string;
  sourceRefs: Array<{ path: string; id: string }>;
}

@Injectable({ providedIn: 'root' })
export class ClinicalDocumentSnapshotService {
  private tenant = inject(TenantService);
  private identity = inject(ClinicalIdentityService);
  private audit = inject(ClinicalAuditService);

  async finalize(input: ClinicalDocumentSnapshotInput): Promise<{ id: string; sha256: string }> {
    if (!auth.currentUser) throw new Error('Sign in required.');
    if (new Blob([input.html]).size > 700_000) {
      throw new Error('This packet is too large for an immutable chart snapshot. Generate smaller sections.');
    }

    const orgId = await this.tenant.currentOrgId();
    const actor = await this.identity.requireCurrentIdentity();
    if (!orgId || actor.orgId !== orgId) throw new Error('Organization context mismatch.');

    const patientSnap = await getDoc(doc(db, 'patients', input.patientId));
    if (!patientSnap.exists()) throw new Error('Patient not found.');
    const patientOrgId = String((patientSnap.data() as any).orgId || (patientSnap.data() as any).orgID || '');
    if (patientOrgId !== orgId) throw new Error('Patient is outside your organization.');

    const id = doc(collection(db, `patients/${input.patientId}/documentSnapshots`)).id;
    const sha256 = await this.hash(input.html);
    await setDoc(doc(db, `patients/${input.patientId}/documentSnapshots/${id}`), {
      orgId,
      patientId: input.patientId,
      kind: input.kind,
      title: input.title,
      format: 'text/html',
      contentHtml: input.html,
      sha256,
      sourceRefs: input.sourceRefs,
      finalizedAt: serverTimestamp(),
      finalizedBy: actor,
      immutable: true,
      schemaVersion: 1,
    });
    await this.audit.record({
      action: 'document_finalized',
      patientId: input.patientId,
      entityType: 'documentSnapshot',
      entityId: id,
      metadata: { kind: input.kind, sourceCount: input.sourceRefs.length },
    });
    return { id, sha256 };
  }

  private async hash(value: string): Promise<string> {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
}
