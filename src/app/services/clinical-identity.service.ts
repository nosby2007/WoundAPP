import { Injectable } from '@angular/core';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { TenantService } from './tenant.service';

export interface ClinicalIdentitySnapshot {
  identityVersion: 1;
  uid: string;
  orgId: string;
  displayName: string;
  role: string;
  roles: string[];
  credentials: string | null;
  npi: string | null;
  licenseNumber: string | null;
  licenseState: string | null;
  facilityIds: string[];
  source: 'users_profile';
  capturedAtIso: string;
}

export interface ClinicalIdentityReadiness {
  ready: boolean;
  missing: string[];
  identity: ClinicalIdentitySnapshot | null;
}

/**
 * Canonical clinician identity for field documentation.
 *
 * Firebase Auth displayName/email are account metadata, not the clinical
 * identity that should be printed or preserved on a medical record. This
 * service resolves users/{uid}, validates tenant membership and returns an
 * immutable snapshot that can be written beside the clinical record.
 */
@Injectable({ providedIn: 'root' })
export class ClinicalIdentityService {
  constructor(private tenant: TenantService) {}

  async currentReadiness(): Promise<ClinicalIdentityReadiness> {
    try {
      const identity = await this.currentIdentity();
      const missing: string[] = [];
      if (!identity?.displayName) missing.push('display name');
      if (!identity?.role) missing.push('clinical role');
      if (!identity?.orgId) missing.push('organization');
      return { ready: !!identity && missing.length === 0, missing, identity };
    } catch {
      return { ready: false, missing: ['clinical profile'], identity: null };
    }
  }

  async requireCurrentIdentity(options: { requireCredentials?: boolean; requireNpi?: boolean } = {}): Promise<ClinicalIdentitySnapshot> {
    const identity = await this.currentIdentity();
    if (!identity) throw new Error('Clinical identity is unavailable. Sign in again.');

    const missing: string[] = [];
    if (!identity.displayName) missing.push('display name');
    if (!identity.role) missing.push('clinical role');
    if (!identity.orgId) missing.push('organization');
    if (options.requireCredentials && !identity.credentials) missing.push('credentials');
    if (options.requireNpi && !identity.npi) missing.push('NPI');

    if (missing.length) {
      throw new Error(`Clinical identity incomplete: ${missing.join(', ')}. Update the staff profile before documenting.`);
    }
    return identity;
  }

  async currentIdentity(): Promise<ClinicalIdentitySnapshot | null> {
    const user = auth.currentUser;
    if (!user) return null;

    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists()) throw new Error('Clinical staff profile not found in users/{uid}.');
    const profile = snap.data() as Record<string, unknown>;
    const orgId = await this.tenant.currentOrgId();
    const profileOrgId = this.string(profile, 'orgId', 'orgID', 'tenantId', 'tenantID');
    if (!orgId || !profileOrgId || profileOrgId !== orgId) {
      throw new Error('Clinical profile organization does not match the authenticated tenant.');
    }

    const displayName = this.string(profile, 'displayName');
    if (!displayName) {
      throw new Error('Clinical identity incomplete: display name is missing from the staff profile. Email aliases are not valid clinical signatures.');
    }

    const role = this.string(profile, 'role') || this.array(profile, 'roles')[0] || '';
    const roles = this.array(profile, 'roles').length ? this.array(profile, 'roles') : (role ? [role] : []);

    return {
      identityVersion: 1,
      uid: user.uid,
      orgId,
      displayName,
      role,
      roles,
      credentials: this.string(profile, 'credentials', 'credential', 'title'),
      npi: this.string(profile, 'npi', 'NPI'),
      licenseNumber: this.string(profile, 'licenseNumber', 'licenseNo', 'license'),
      licenseState: this.string(profile, 'licenseState', 'licenseJurisdiction'),
      facilityIds: this.array(profile, 'facilityIds'),
      source: 'users_profile',
      capturedAtIso: new Date().toISOString(),
    };
  }

  private string(source: Record<string, unknown>, ...keys: string[]): string | null {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return null;
  }

  private array(source: Record<string, unknown>, key: string): string[] {
    const value = source[key];
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string' && !!item.trim()).map(item => item.trim())
      : [];
  }
}
