import { schedulerBillingEntity, schedulerBillingProvider, schedulerBillingSnapshot, scheduledBillingEntitySnapshot } from './scheduler-billing';

describe('Scheduler billing attribution', () => {
  const organization = { billingProfile: { billingProviderName: 'Example Group', billingNpi: '1234567890' } };
  const staff = { orgId: 'org-a', displayName: 'Example NP', role: 'np', npi: '0123456789', billingProviderEnabled: true, active: true };

  it('uses the existing organization billing profile without substituting branding', () => {
    expect(schedulerBillingEntity('org-a', { ...organization, name: 'Different brand' }))
      .toEqual({ id: 'org-a', name: 'Example Group', npi: '1234567890' });
  });
  it('does not invent PHWC defaults or substitute an individual provider when configuration is absent', () => {
    for (const org of ['PHWC', 'other-org']) {
      expect(schedulerBillingEntity(org, null)).toBeNull();
      expect(schedulerBillingEntity(org, { name: 'Brand', npi: '0123456789' })).toBeNull();
    }
  });
  it('rejects incomplete, malformed or inactive entities', () => {
    expect(schedulerBillingEntity('', organization)).toBeNull();
    expect(schedulerBillingEntity('org-a', { billingProfile: { billingProviderName: 'Group', billingNpi: '123' } })).toBeNull();
    expect(schedulerBillingEntity('org-a', { ...organization, active: false })).toBeNull();
  });
  it('requires a same-tenant active billing-enabled provider with an NPI', () => {
    expect(schedulerBillingProvider('org-a', 'np-1', staff)?.uid).toBe('np-1');
    for (const patch of [{ orgId: 'org-b' }, { billingProviderEnabled: false }, { active: false }, { npi: 'bad' }, { role: 'nurse' }]) {
      expect(schedulerBillingProvider('org-a', 'np-1', { ...staff, ...patch })).toBeNull();
    }
  });
  it('persists entity and provider separately without replacing the performer', () => {
    const data = schedulerBillingSnapshot(schedulerBillingProvider('org-a', 'np-1', staff)!, schedulerBillingEntity('org-a', organization)!);
    expect(data).toEqual({ billingProviderUid: 'np-1', billingProviderName: 'Example NP', billingProviderNpi: '0123456789',
      billingEntityId: 'org-a', billingEntityName: 'Example Group', billingEntityNpi: '1234567890' });
    expect((data as any).assignedToUid).toBeUndefined();
  });
  it('carries selected entity into a new field visit without inventing legacy attribution', () => {
    expect(scheduledBillingEntitySnapshot({ orgId: 'org-a', billingEntityId: 'org-a', billingEntityName: 'Example Group', billingEntityNpi: '1234567890' }))
      .toEqual({ billingEntityId: 'org-a', billingEntityName: 'Example Group', billingEntityNpi: '1234567890' });
    expect(scheduledBillingEntitySnapshot({ billingProviderName: 'NP', billingProviderNpi: '0123456789' }))
      .toEqual({ billingEntityId: null, billingEntityName: null, billingEntityNpi: null });
    expect(scheduledBillingEntitySnapshot({ orgId: 'org-a', billingEntityId: 'org-b', billingEntityName: 'Other group', billingEntityNpi: '1234567890' }).billingEntityId).toBeNull();
  });
});
