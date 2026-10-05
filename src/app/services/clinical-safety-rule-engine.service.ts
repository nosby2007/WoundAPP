// src/app/services/clinical-safety-rule-engine.service.ts
import { Injectable, inject } from '@angular/core';
import {
  evaluateNerds,
  evaluateStonees,
  evaluateAbpiSafety,
  generateClinicalSafetySnapshot,
  ClinicalSafetySnapshot,
  NerdsEvaluationResult,
  StoneesEvaluationResult,
  AbpiSafetyEvaluationResult,
} from '../shared/clinical-safety-rules';
import { ClinicalAuditService } from './clinical-audit.service';

@Injectable({ providedIn: 'root' })
export class ClinicalSafetyRuleEngineService {
  private audit = inject(ClinicalAuditService);

  evaluateAssessment(data: any): ClinicalSafetySnapshot {
    const describe = data?.describe || {};
    const woundBed = data?.woundBed || {};
    const exudate = data?.exudate || {};
    const measurements = data?.measurements || {};
    const progress = data?.progress || {};
    const periWound = data?.periWound || {};

    const infectionList: string[] = Array.isArray(woundBed?.infection) ? woundBed.infection : [];
    const clinicalFindings: string[] = [
      ...infectionList,
      progress?.status || '',
      describe?.type || '',
    ].filter(Boolean);

    const nerdsInput = {
      isNonHealing: progress?.status === 'stalled' || progress?.status === 'deteriorating',
      exudateAmount: exudate?.amount || null,
      exudateIncreased: exudate?.amount === 'heavy' || exudate?.amount === 'moderate',
      granulationBleedsEasily: woundBed?.granulation?.friable === true || infectionList.some(i => i.toLowerCase().includes('bleed')),
      hypergranulation: woundBed?.granulation?.hyper === true || infectionList.some(i => i.toLowerCase().includes('hypergranulation')),
      sloughPercent: woundBed?.slough?.percent ?? (woundBed?.slough?.present ? 30 : 0),
      sloughPresent: woundBed?.slough?.present === true,
      escharPresent: woundBed?.eschar === true || woundBed?.eschar?.present === true,
      debrisPresent: woundBed?.debris === true,
      odorPresent: exudate?.odor && exudate.odor !== 'None' && exudate.odor !== '',
      odorType: exudate?.odor || null,
      clinicalFindings,
    };

    const stoneesInput = {
      sizeIncreasing: progress?.status === 'deteriorating' || data?.sizeIncreasing === true,
      depthIncreased: measurements?.depth > 1.5,
      temperatureIncreased: periWound?.warmth === true || periWound?.temperature === 'warm' || periWound?.temperature === 'hot',
      probesToBone: woundBed?.probesToBone === true || woundBed?.boneVisible === true || infectionList.some(i => i.toLowerCase().includes('bone')),
      boneVisible: woundBed?.boneVisible === true,
      newBreakdownPresent: progress?.satelliteLesions === true || periWound?.maceration === true,
      satelliteLesions: progress?.satelliteLesions === true,
      erythemaExtended: periWound?.erythemaExtended === true || (periWound?.erythemaDistanceCm && periWound.erythemaDistanceCm >= 2),
      erythemaDistanceCm: periWound?.erythemaDistanceCm || (periWound?.erythema === 'severe' ? 3 : 0),
      indurationPresent: periWound?.induration === true,
      exudatePurulent: exudate?.type === 'purulent' || exudate?.type === 'seropurulent' || infectionList.some(i => i.toLowerCase().includes('purulent')),
      edemaPresent: periWound?.edema === true || periWound?.edema === 'moderate' || periWound?.edema === 'severe',
      odorFoulPutrid: exudate?.odor === 'Foul' || exudate?.odor === 'Putrid',
      clinicalFindings,
    };

    const rawAbpi = data?.abpi ?? data?.perfusion?.abpi ?? null;
    const parsedAbpi = rawAbpi !== null && rawAbpi !== undefined && !Number.isNaN(Number(rawAbpi)) ? Number(rawAbpi) : null;

    const snapshot = generateClinicalSafetySnapshot({
      nerdsInput,
      stoneesInput,
      abpiValue: parsedAbpi,
    });

    return snapshot;
  }

  evaluateNerdsOnly(input: Parameters<typeof evaluateNerds>[0]): NerdsEvaluationResult {
    return evaluateNerds(input);
  }

  evaluateStoneesOnly(input: Parameters<typeof evaluateStonees>[0]): StoneesEvaluationResult {
    return evaluateStonees(input);
  }

  evaluateAbpiOnly(abpi: number | null | undefined): AbpiSafetyEvaluationResult {
    return evaluateAbpiSafety(abpi);
  }

  async auditSafetyAlertTriggered(patientId: string, alertType: string, details: any): Promise<void> {
    await this.audit.record({
      action: 'clinical_safety_alert_triggered',
      patientId,
      entityType: 'safetyAlert',
      entityId: alertType,
      metadata: details,
    });
  }
}
