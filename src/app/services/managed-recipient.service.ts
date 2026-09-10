import { Injectable, inject } from '@angular/core';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { TenantService } from './tenant.service';

export interface DeliveryRecipient {
  id: string;
  name: string;
  organization?: string | null;
  recipientType: 'provider' | 'facility' | 'case_manager' | 'referring_provider' | 'other';
  preferredMethod: 'secure_email' | 'secure_fax';
  destinationToken: string;
  active: boolean;
}

@Injectable({ providedIn: 'root' })
export class ManagedRecipientService {
  private tenant = inject(TenantService);

  async list(): Promise<DeliveryRecipient[]> {
    const orgId = await this.tenant.currentOrgId();
    if (!orgId) return [];
    const snap = await getDocs(collection(db, `organizations/${orgId}/deliveryRecipients`));
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) } as DeliveryRecipient))
      .filter((row) => row.active !== false && !!row.name && !!row.destinationToken)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  maskedDestination(recipient: DeliveryRecipient): string {
    const value = recipient.destinationToken || '';
    if (recipient.preferredMethod === 'secure_email') {
      const [local, domain] = value.split('@');
      return domain ? `${(local || '').slice(0, 2)}•••@${domain}` : 'Secure email';
    }
    const digits = value.replace(/\D/g, '');
    return digits.length >= 4 ? `••• ••• ${digits.slice(-4)}` : 'Secure fax';
  }
}
