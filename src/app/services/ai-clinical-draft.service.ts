import { Injectable } from '@angular/core';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

export interface AiDraftRequest {
  sectionKey: string;
  sectionTitle: string;
  structuredData: Record<string, unknown>;
  priorText?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AiClinicalDraftService {
  private readonly suggestFn = httpsCallable<AiDraftRequest, { text: string; truncatedForSafety: boolean }>(
    functions,
    'suggestClinicalNarrativeV1',
  );

  /**
   * Draft-only by design. This service has no Firestore dependency and cannot
   * save, sign, place orders, or mutate the chart.
   */
  async suggest(request: AiDraftRequest): Promise<string> {
    const result = await this.suggestFn(request);
    return (result.data?.text || '').trim();
  }
}
