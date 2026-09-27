import { FieldRolePolicyService } from './field-role-policy.service';

describe('FieldRolePolicyService role boundary', () => {
  const policy = new FieldRolePolicyService({} as any);
  const identity = (role: string) => ({ role, roles: [role] } as any);

  it('keeps an SNF wound nurse in facility wound-round review only', () => {
    const woundNurse = identity('wound_nurse');
    expect(policy.canUseWoundRoundWorkspace(woundNurse)).toBeTrue();
    expect(policy.canUseClinicalWorkspace(woundNurse)).toBeFalse();
    expect(policy.canUseFieldToday(woundNurse)).toBeFalse();
  });

  it('keeps an organization RN in the clinical and wound-round workspaces', () => {
    const rn = identity('rn');
    expect(policy.canUseClinicalWorkspace(rn)).toBeTrue();
    expect(policy.canUseWoundRoundWorkspace(rn)).toBeTrue();
    expect(policy.canUseFieldToday(rn)).toBeTrue();
  });
});
