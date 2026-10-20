/** Billing attribution is separate from the clinician assigned to perform care.
 * Only configured tenant data is accepted; this does not authorize a claim.
 */
export interface SchedulerBillingEntity {
  id: string;
  name: string;
  npi: string;
}

export interface SchedulerBillingProvider {
  uid: string;
  displayName: string;
  role: string;
  npi: string;
}

const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

export function schedulerBillingEntity(orgId: string, organization: any): SchedulerBillingEntity | null {
  const profile = organization?.billingProfile;
  const name = text(profile?.billingProviderName);
  const npi = text(profile?.billingNpi);
  // Same organization billingProfile used by JADE's TenantBillingProfileService.
  // Never fall back to another tenant, a display/brand name, or an individual's NPI.
  return orgId && name && /^\d{10}$/.test(npi) && organization?.active !== false && organization?.status !== 'inactive'
    ? { id: orgId, name, npi } : null;
}

export function schedulerBillingProvider(orgId: string, uid: string, record: any): SchedulerBillingProvider | null {
  const role = text(record?.role).toLowerCase();
  const npi = text(record?.npi);
  const displayName = text(record?.displayName) || text(record?.name);
  return record?.orgId === orgId && record?.billingProviderEnabled === true &&
    record?.active !== false && record?.status !== 'inactive' &&
    ['provider', 'np', 'md', 'do', 'physician'].includes(role) &&
    uid && displayName && /^\d{10}$/.test(npi)
    ? { uid, displayName, role, npi } : null;
}

export function schedulerBillingSnapshot(provider: SchedulerBillingProvider, entity: SchedulerBillingEntity) {
  return {
    billingProviderUid: provider.uid,
    billingProviderName: provider.displayName,
    billingProviderNpi: provider.npi,
    billingEntityId: entity.id,
    billingEntityName: entity.name,
    billingEntityNpi: entity.npi,
  };
}

/** Copy only source attribution, never infer a billing entity from the performer. */
export function scheduledBillingEntitySnapshot(appointment: Record<string, any>) {
  const sameTenant = !!appointment['orgId'] && appointment['billingEntityId'] === appointment['orgId'];
  return {
    billingEntityId: sameTenant ? appointment['billingEntityId'] : null,
    billingEntityName: sameTenant ? appointment['billingEntityName'] ?? null : null,
    billingEntityNpi: sameTenant ? appointment['billingEntityNpi'] ?? null : null,
  };
}
