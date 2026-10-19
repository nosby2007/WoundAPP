export function canFacilitateTelehealth(roles: string[]): boolean {
  const allowed = ['nurse', 'rn', 'registered_nurse', 'lpn', 'lvn',
    'clinical_admin', 'org_admin', 'admin', 'super_admin'];
  return roles.some(role => allowed.includes(role.trim().toLowerCase().replace(/[ -]+/g, '_')));
}

export function isVirtualVisit(mode: unknown): boolean {
  return mode === 'telehealth_video' || mode === 'telehealth_audio';
}
