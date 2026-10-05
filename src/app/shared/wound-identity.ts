/**
 * Which wound an assessment belongs to.
 *
 * The web app builds a patient's wound registry by grouping assessments:
 *
 *   const woundId = assessment.woundId ?? assessment.id;
 *       -- core/wound-workflow.service.ts, buildRegistry()
 *
 * So the field is not decoration. An assessment without it is, to every
 * reader, a wound of its own: a separate row in the registry, a separate
 * timeline, a separate healing trajectory, and -- once the registry's lazy
 * backfill writes a wounds/{id} document for it -- a permanent one.
 *
 * The rules live here rather than in the form because getting one of them
 * wrong is silent. Nothing throws; the chart simply grows a wound that was
 * never there, or loses one into another's history.
 */

/** What a brand-new wound's first assessment is: its own identity. */
export function woundIdForNewWound(assessmentId: string): string {
  return assessmentId;
}

/**
 * The `woundId` to store on a newly created assessment.
 *
 * @param routeWoundId The ?woundId= a re-evaluation was opened with, if any.
 * @param newAssessmentId The id this assessment is being created at.
 * @return The parent wound for a re-evaluation; otherwise the assessment's
 *   own id, because a new wound IS its own first assessment. This is the
 *   value the web's fallback already computes -- written down rather than
 *   left to be inferred.
 */
export function woundIdForCreate(
  routeWoundId: string | null | undefined,
  newAssessmentId: string,
): string {
  const parent = (routeWoundId ?? '').trim();
  return parent ? parent : woundIdForNewWound(newAssessmentId);
}

/**
 * What an EDIT may write to `woundId`: nothing, ever.
 *
 * An edit is about a dressing or a measurement. Re-deriving the wound
 * identity there would let a screen that is not about wound identity move an
 * assessment onto another wound's timeline, or split a wound in two --
 * without an error, and without anyone looking.
 *
 * Returns the payload with the key removed, which in Firestore means "leave
 * whatever is stored alone" (an omitted key in update() is a no-op).
 */
export function stripWoundIdForUpdate<T extends Record<string, unknown>>(payload: T): T {
  const next = { ...payload };
  delete next['woundId'];
  return next;
}

/**
 * How a reader should resolve an assessment's wound, including the legacy
 * documents that carry no `woundId` at all.
 *
 * Identical to the web's fallback on purpose. Assessments written before the
 * mobile form stamped the field keep whatever identity the registry already
 * gave them; this does not repair a timeline that was split back then, and
 * nothing client-side can, because the parent wound of such a document was
 * never recorded anywhere.
 */
export function resolveWoundId(
  assessment: { woundId?: string | null; id?: string | null } | null | undefined,
): string | null {
  if (!assessment) return null;
  const stored = (assessment.woundId ?? '').trim();
  if (stored) return stored;
  const own = (assessment.id ?? '').trim();
  return own ? own : null;
}

/** One wound, as the chart shows it: its newest assessment, and how many
 *  assessments stand behind that one. */
export interface WoundGroup<T> {
  woundId: string;
  latest: T;
  /** Total assessments on this wound, the latest included. 1 = never
   *  re-evaluated. */
  assessmentCount: number;
}

/**
 * Groups a patient's assessments into wounds: one entry per wound, carrying
 * its newest assessment, newest wound first.
 *
 * THIS IS THE RULE THE WEB USES (`woundId ?? id`, then sort by assessedAt),
 * and both apps have to use it or they disagree about how many wounds the
 * patient has. That is not a cosmetic disagreement: a re-evaluation shown as
 * a second wound is a second healing trajectory, a second row in every count,
 * and a second thing to dress.
 */
export function groupAssessmentsByWound<
  T extends { id?: string | null; woundId?: string | null; assessedAt?: Date | null }
>(assessments: T[]): Array<WoundGroup<T>> {
  const byWound = new Map<string, WoundGroup<T>>();

  for (const assessment of assessments) {
    const woundId = resolveWoundId(assessment);
    if (!woundId) continue;

    const current = byWound.get(woundId);
    if (!current) {
      byWound.set(woundId, { woundId, latest: assessment, assessmentCount: 1 });
      continue;
    }

    current.assessmentCount += 1;

    // An assessment with no date cannot displace one that has a date: "no
    // recorded time" is not "now".
    const candidateAt = assessment.assessedAt?.getTime?.() ?? null;
    const currentAt = current.latest.assessedAt?.getTime?.() ?? null;
    if (candidateAt !== null && (currentAt === null || candidateAt > currentAt)) {
      current.latest = assessment;
    }
  }

  return Array.from(byWound.values()).sort((left, right) => {
    const l = left.latest.assessedAt?.getTime?.() ?? 0;
    const r = right.latest.assessedAt?.getTime?.() ?? 0;
    return r - l;
  });
}

/**
 * The current state of each of a patient's wounds: the newest assessment per
 * wound, newest wound first.
 *
 * The same grouping as above, without the counts -- kept because the progress
 * note only needs the assessments themselves.
 */
export function latestAssessmentPerWound<
  T extends { id?: string | null; woundId?: string | null; assessedAt?: Date | null }
>(assessments: T[]): T[] {
  return groupAssessmentsByWound(assessments).map((group) => group.latest);
}
