import { Injectable, inject } from '@angular/core';
import { collection, getDocs } from 'firebase/firestore';

import { db } from '../firebase';
import { TenantService } from './tenant.service';
import { BradenSubscale } from '../shared/braden';

/**
 * What to do about a Braden answer.
 *
 * The wording is NOT in this app. It lives in
 * organizations/{orgId}/bradenInterventionCatalog, authored by an
 * administrator in the web app (Admin -> Braden actions), because these are
 * clinical instructions the organization is accountable for. Shipping a
 * default set here would put instructions into every organization's charts
 * over a nurse's name, approved by nobody -- the same rule the wound
 * vocabulary, the care plan goals and the education topics already follow.
 *
 * An empty catalog therefore shows an empty list, and the screen says so.
 * That is the honest answer, not a bug to paper over with defaults.
 *
 * Built on the plain modular SDK (db from ../firebase) for the reason
 * recorded in a713a49d: mixing injected Auth and Firestore in a
 * root-provided service here produces NG0200.
 */

export interface BradenAction {
  id: string;
  subscale: BradenSubscale;
  score: number;
  text: string;
}

@Injectable({ providedIn: 'root' })
export class BradenInterventionService {
  private tenant = inject(TenantService);

  private cachedOrgId: string | null = null;
  private cached: BradenAction[] | null = null;

  /**
   * The org's whole catalog, read once per session.
   *
   * Read whole and filtered in memory rather than queried per subscale and
   * score. Two equality clauses with no matching index fail as an EMPTY
   * result, which here is indistinguishable from "the admin has not written
   * any actions for this answer" -- and a nurse would have no way to tell
   * that a real instruction was being withheld. It is a short, admin-curated
   * list; reading all of it costs one round trip.
   */
  async list(): Promise<BradenAction[]> {
    const orgId = await this.tenant.currentOrgId();
    if (!orgId) return [];

    if (this.cachedOrgId === orgId && this.cached) return this.cached;

    const snap = await getDocs(collection(db, `organizations/${orgId}/bradenInterventionCatalog`));
    const items = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) } as any))
      .filter((item) =>
        item.active !== false &&
        typeof item.text === 'string' && item.text.trim() &&
        typeof item.subscale === 'string' &&
        Number.isFinite(Number(item.score)))
      .map((item) => ({
        id: item.id as string,
        subscale: item.subscale as BradenSubscale,
        score: Number(item.score),
        text: String(item.text).trim(),
      }));

    this.cachedOrgId = orgId;
    this.cached = items;
    return items;
  }

  /** Forgets the cache -- call on sign-out so the next user starts clean. */
  reset(): void {
    this.cachedOrgId = null;
    this.cached = null;
  }
}
