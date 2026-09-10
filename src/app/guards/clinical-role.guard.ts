import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ClinicalIdentityService } from '../services/clinical-identity.service';

export const clinicalRoleGuard: CanActivateFn = async (route) => {
  const identityService = inject(ClinicalIdentityService);
  const router = inject(Router);
  const allowed = ((route.data?.['roles'] || []) as string[]).map((r) => r.toLowerCase());
  if (!allowed.length) return true;

  try {
    const identity = await identityService.requireCurrentIdentity();
    const roles = new Set([identity.role, ...(identity.roles || [])].map((r) => String(r || '').toLowerCase()));
    if (allowed.some((role) => roles.has(role))) return true;
  } catch {
    // handled by redirect below
  }
  return router.createUrlTree(['/tabs/patients'], { queryParams: { access: 'role' } });
};
