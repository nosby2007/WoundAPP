import { Injectable } from '@angular/core';
import { ClinicalIdentityService, ClinicalIdentitySnapshot } from './clinical-identity.service';

export type FieldAccessLevel = 'clinical' | 'support' | 'administrative' | 'unknown';

const CLINICAL_ROLES = new Set([
  'rn', 'registered_nurse', 'registered nurse',
  'lpn', 'lvn', 'licensed_practical_nurse', 'licensed practical nurse',
  'nurse', 'wound_nurse', 'wound_nurse_internal',
  'np', 'nurse_practitioner', 'nurse practitioner',
  'md', 'do', 'physician', 'provider',
  'don', 'clinical_admin', 'org_admin', 'admin', 'super_admin',
]);

const SUPPORT_ROLES = new Set([
  'cna', 'certified_nursing_assistant', 'certified nursing assistant',
  'caregiver', 'personal_care_aide', 'personal care aide',
  'companion', 'sitter', 'home_health_aide', 'home health aide', 'hha',
]);

const ADMIN_ROLES = new Set([
  'receptionist', 'reception', 'frontdesk', 'front_desk',
  'scheduler', 'hr', 'billing', 'finance', 'employer', 'employee',
]);

const SUPPORT_VISIT_TYPES = new Set([
  'adl', 'adl_visit', 'personal_care', 'personal care',
  'companion', 'companion_activity', 'companion activities',
  'sitter', 'homemaker', 'caregiver', 'hha', 'home_health_aide',
]);

@Injectable({ providedIn: 'root' })
export class FieldRolePolicyService {
  constructor(private identity: ClinicalIdentityService) {}

  async currentIdentity(): Promise<ClinicalIdentitySnapshot | null> {
    try { return await this.identity.currentIdentity(); } catch { return null; }
  }

  async currentAccessLevel(): Promise<FieldAccessLevel> {
    return this.accessLevel(await this.currentIdentity());
  }

  accessLevel(identity: ClinicalIdentitySnapshot | null): FieldAccessLevel {
    const roles = this.normalizedRoles(identity);
    if (roles.some(role => CLINICAL_ROLES.has(role))) return 'clinical';
    if (roles.some(role => SUPPORT_ROLES.has(role))) return 'support';
    if (roles.some(role => ADMIN_ROLES.has(role))) return 'administrative';
    return 'unknown';
  }

  canUseClinicalWorkspace(identity: ClinicalIdentitySnapshot | null): boolean {
    return this.accessLevel(identity) === 'clinical';
  }

  canUseSupportWorkspace(identity: ClinicalIdentitySnapshot | null): boolean {
    return this.accessLevel(identity) === 'support';
  }

  canUseFieldToday(identity: ClinicalIdentitySnapshot | null): boolean {
    const level = this.accessLevel(identity);
    return level === 'clinical' || level === 'support';
  }

  canSeeVisitHistory(identity: ClinicalIdentitySnapshot | null): boolean {
    return this.canUseClinicalWorkspace(identity);
  }

  canUseSchedulingWorkspace(identity: ClinicalIdentitySnapshot | null): boolean {
    const roles = this.normalizedRoles(identity);
    return roles.some(role => [
      'scheduler', 'employer', 'employee', 'frontdesk', 'front_desk',
      'reception', 'receptionist', 'hr', 'clinical_admin', 'org_admin',
      'admin', 'super_admin'
    ].includes(role));
  }

  canCreatePatient(identity: ClinicalIdentitySnapshot | null): boolean {
    return this.canUseClinicalWorkspace(identity) || this.canUseSchedulingWorkspace(identity);
  }

  isSupportVisit(visit: Record<string, any>): boolean {
    const workflow = this.normalize(visit['workflowKind']);
    const type = this.normalize(visit['visitType']);
    const service = this.normalize(visit['serviceLevel'] ?? visit['serviceCategory'] ?? visit['serviceType']);
    return ['adl', 'companion', 'personal_care', 'support', 'homemaker'].includes(workflow) ||
      SUPPORT_VISIT_TYPES.has(type) || SUPPORT_VISIT_TYPES.has(service);
  }

  canAccessAssignedVisit(identity: ClinicalIdentitySnapshot | null, visit: Record<string, any>): boolean {
    const level = this.accessLevel(identity);
    if (level === 'clinical') return !this.isSupportVisit(visit) || this.isSupportVisit(visit);
    if (level === 'support') return this.isSupportVisit(visit);
    return false;
  }

  normalizedRoles(identity: ClinicalIdentitySnapshot | null): string[] {
    if (!identity) return [];
    return Array.from(new Set([identity.role, ...(identity.roles || [])].map(role => this.normalize(role)).filter(Boolean)));
  }

  private normalize(value: unknown): string {
    return String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  }
}
