import { ClinicalVisitLink, matchesClinicalVisitLink } from './clinical-visit-link';

/** An encounter is provenance, not the expiry date of an ongoing order. */
export function isCurrentOrder(order: any, at = new Date()): boolean {
  if (!order || order.archivedAt || order.discontinuedAt || order.supersededByOrderId) return false;
  const inactive = ['discontinued', 'completed', 'cancelled', 'canceled', 'archived', 'voided', 'rejected', 'declined', 'superseded'];
  if (inactive.includes(String(order.status || '').toLowerCase()) ||
      inactive.includes(String(order.workflow?.state || '').toLowerCase()) ||
      order.coSignature?.status === 'declined') return false;
  const millis = (v: any): number => v?.toMillis ? v.toMillis() : v?.toDate ? v.toDate().getTime() : new Date(v).getTime();
  const start = order.clinical?.schedule?.startAt;
  const end = order.clinical?.schedule?.endAt || order.expiresAt;
  return !(start && millis(start) > at.getTime()) && !(end && millis(end) <= at.getTime());
}

export function orderAppliesToWound(order: any, woundId?: string | null, episodeId?: string | null): boolean {
  if (woundId && order.woundId && order.woundId !== woundId) return false;
  if (episodeId && order.episodeId && order.episodeId !== episodeId) return false;
  return true;
}

export function orderAppliesToEncounter(order: any, link: ClinicalVisitLink, woundIds: string[]): boolean {
  if (!orderAppliesToWound(order, link.woundId, link.episodeId)) return false;
  if (!order.woundId) return true; // Patient-level order in this patient's collection.
  if (link.woundId) return order.woundId === link.woundId;
  return woundIds.includes(order.woundId) || matchesClinicalVisitLink(order, link);
}

export function orderEditFingerprint(order: any): string {
  return JSON.stringify({ description: order.description, clinical: order.clinical, treatmentProtocol: order.treatmentProtocol });
}
