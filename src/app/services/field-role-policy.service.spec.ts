import { FieldRolePolicyService } from './field-role-policy.service';

describe('FieldRolePolicyService role boundary', () => {
  const policy = new FieldRolePolicyService({} as any);
  const identity = (role: string, facilityIds: string[] = []) => ({ role, roles: [role], facilityIds } as any);

  it('uses one canonical NP role for supported profile aliases', () => {
    for (const role of ['np','nurse_practitioner','Nurse Practitioner']) {
      expect(policy.normalizedRoles(identity(role))).toEqual(['np']);
      expect(policy.canUseClinicalWorkspace(identity(role))).toBeTrue();
    }
  });

  it('keeps an SNF wound nurse in facility wound-round review only', () => {
    const woundNurse = identity('wound_nurse', ['facility-a']);
    expect(policy.canUseWoundRoundWorkspace(woundNurse)).toBeTrue();
    expect(policy.canUseClinicalWorkspace(woundNurse)).toBeFalse();
    expect(policy.canUseFieldToday(woundNurse)).toBeFalse();
    expect(policy.canReviewFacility(woundNurse, 'facility-a')).toBeTrue();
    expect(policy.canReviewFacility(woundNurse, 'facility-b')).toBeFalse();
  });

  it('denies the review workspace when a facility reviewer has no assignment', () => {
    const don = identity('don');
    expect(policy.canUseWoundRoundWorkspace(don)).toBeFalse();
    expect(policy.canReviewFacility(don, 'facility-a')).toBeFalse();
  });

  it('keeps an organization RN in the clinical and wound-round workspaces', () => {
    const rn = identity('rn');
    expect(policy.canUseClinicalWorkspace(rn)).toBeTrue();
    expect(policy.canUseWoundRoundWorkspace(rn)).toBeTrue();
    expect(policy.canUseFieldToday(rn)).toBeTrue();
  });
});
