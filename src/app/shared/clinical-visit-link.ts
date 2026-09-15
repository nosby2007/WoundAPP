export interface ClinicalVisitLink {
  visitId?: string | null;
  appointmentId?: string | null;
  woundId?: string | null;
  episodeId?: string | null;
  fieldEncounterVisitId?: string | null;
}

export function clinicalVisitLinkFields(link?: ClinicalVisitLink | null): Record<string, string | null> {
  if (!link) return {};
  const visitId = (link.visitId || '').trim() || null;
  const appointmentId = (link.appointmentId || '').trim() || null;
  const woundId = (link.woundId || '').trim() || null;
  const episodeId = (link.episodeId || '').trim() || null;
  const fieldEncounterVisitId = (link.fieldEncounterVisitId || '').trim() || null;
  return {
    visitId,
    woundVisitId: visitId,
    appointmentId,
    woundId,
    episodeId,
    fieldEncounterVisitId,
  };
}

export function clinicalVisitQueryParams(link?: ClinicalVisitLink | null): Record<string, string> | undefined {
  if (!link) return undefined;
  const params: Record<string, string> = {};
  if (link.appointmentId) params['appointmentId'] = link.appointmentId;
  if (link.visitId) params['woundVisitId'] = link.visitId;
  if (link.woundId) params['woundId'] = link.woundId;
  if (link.episodeId) params['episodeId'] = link.episodeId;
  if (link.fieldEncounterVisitId) params['fieldEncounterVisitId'] = link.fieldEncounterVisitId;
  return Object.keys(params).length ? params : undefined;
}

export function matchesClinicalVisitLink(row: any, link?: ClinicalVisitLink | null): boolean {
  if (!row || !link) return false;
  const visitId = (link.visitId || '').trim();
  const appointmentId = (link.appointmentId || '').trim();

  if (visitId) {
    const visitRefs = [
      row.id,
      row.visitId,
      row.woundVisitId,
      row.clinicalVisitId,
      row.fieldEncounterVisitId,
      row.mobileWorkflow?.woundVisitId,
    ].filter(Boolean).map(String);
    if (visitRefs.includes(visitId)) return true;
  }

  if (appointmentId) {
    const appointmentRefs = [
      row.appointmentId,
      row.mobileWorkflow?.appointmentId,
    ].filter(Boolean).map(String);
    if (appointmentRefs.includes(appointmentId)) return true;
  }

  return false;
}
