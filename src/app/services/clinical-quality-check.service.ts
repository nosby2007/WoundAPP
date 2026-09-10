import { Injectable } from '@angular/core';

export type QualitySeverity = 'info' | 'warning' | 'high';

export interface ClinicalQualityFinding {
  code: string;
  severity: QualitySeverity;
  title: string;
  message: string;
  entityType: string;
  entityId?: string | null;
}

@Injectable({ providedIn: 'root' })
export class ClinicalQualityCheckService {
  checkWoundAssessments(rows: any[]): ClinicalQualityFinding[] {
    const findings: ClinicalQualityFinding[] = [];

    for (const row of rows || []) {
      const id = row.id || null;
      const m = row.measurements || {};
      for (const key of ['length','width','depth','area','volume']) {
        const value = m[key];
        if (value !== null && value !== undefined && value !== '' && Number(value) < 0) {
          findings.push({
            code: 'NEGATIVE_MEASUREMENT',
            severity: 'high',
            title: 'Invalid wound measurement',
            message: `${key} is below zero. Review the assessment before finalizing.`,
            entityType: 'woundAssessment',
            entityId: id,
          });
        }
      }

      const status = String(row.progress?.status || row.status || '').toLowerCase();
      const amount = String(row.exudate?.amount || '').toLowerCase();
      if (/(closed|healed)/.test(status) && /(moderate|large|copious|heavy)/.test(amount)) {
        findings.push({
          code: 'CLOSED_WITH_DRAINAGE',
          severity: 'warning',
          title: 'Clinical data needs review',
          message: 'The wound is marked closed/healed while drainage is documented as moderate or greater.',
          entityType: 'woundAssessment',
          entityId: id,
        });
      }

      const stage = String(row.describe?.stage || row.stage || '').toLowerCase();
      const type = String(row.describe?.type || row.type || '').toLowerCase();
      if (stage && !/pressure/.test(type) && !['n/a','na','none',''].includes(stage)) {
        findings.push({
          code: 'STAGE_ON_NON_PRESSURE_WOUND',
          severity: 'info',
          title: 'Verify staging field',
          message: 'A stage is documented on a wound not identified as a pressure injury. Confirm the classification is intentional.',
          entityType: 'woundAssessment',
          entityId: id,
        });
      }
    }

    return findings;
  }

  checkBraden(rows: any[]): ClinicalQualityFinding[] {
    return (rows || []).flatMap((row) => {
      const score = Number(row.score ?? row.total);
      if (!Number.isFinite(score)) return [];
      if (score < 6 || score > 23) {
        return [{
          code: 'BRADEN_RANGE',
          severity: 'high' as const,
          title: 'Braden score outside expected range',
          message: 'The recorded Braden total is outside 6–23. Review the subscale entries.',
          entityType: 'braden',
          entityId: row.id || null,
        }];
      }
      return [];
    });
  }

  checkOrderWoundLinks(orders: any[], woundAssessments: any[]): ClinicalQualityFinding[] {
    const woundIds = new Set((woundAssessments || []).map((r) => r.woundId || r.id).filter(Boolean));
    return (orders || [])
      .filter((order) => order.woundId && !woundIds.has(order.woundId))
      .map((order) => ({
        code: 'ORDER_UNKNOWN_WOUND',
        severity: 'warning' as const,
        title: 'Order references an unknown wound',
        message: 'The order is linked to a wound that is not present in the current wound registry.',
        entityType: 'order',
        entityId: order.id || null,
      }));
  }
}
