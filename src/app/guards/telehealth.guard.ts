import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { FieldRolePolicyService } from '../services/field-role-policy.service';
import { canFacilitateTelehealth } from '../shared/telehealth-policy';

export const telehealthFacilitatorGuard: CanActivateFn = async () => {
  const policy = inject(FieldRolePolicyService);
  const router = inject(Router);
  const identity = await policy.currentIdentity();
  return identity && canFacilitateTelehealth([identity.role, ...(identity.roles || [])])
    ? true : router.createUrlTree(['/tabs/more']);
};
