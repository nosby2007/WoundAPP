import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { FieldRolePolicyService } from '../services/field-role-policy.service';

export const fieldAccessGuard: CanActivateFn = async (route) => {
  const policy = inject(FieldRolePolicyService);
  const router = inject(Router);
  const identity = await policy.currentIdentity();
  const required = String(route.data?.['access'] || 'field');

  const allowed = required === 'clinical'
    ? policy.canUseClinicalWorkspace(identity)
    : required === 'support'
      ? policy.canUseSupportWorkspace(identity)
      : required === 'scheduling'
        ? policy.canUseSchedulingWorkspace(identity)
        : required === 'intake'
          ? policy.canCreatePatient(identity)
          : policy.canUseFieldToday(identity);

  return allowed
    ? true
    : router.createUrlTree(['/tabs/more'], { queryParams: { access: required } });
};
