import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { ClinicalQualityCheckService } from './clinical-quality-check.service';
import { VisitCompletenessService } from './visit-completeness.service';

export interface SmartClinicalNotification {
  id: string;
  patientId: string;
  patientName: string;
  mrn?: string | null;
  severity: 'info' | 'warning' | 'high';
  title: string;
  message: string;
  actionRoute: string[];
}

@Injectable({ providedIn: 'root' })
export class SmartNotificationService {
  private api = inject(ApiService);
  private quality = inject(ClinicalQualityCheckService);
  private completeness = inject(VisitCompletenessService);

  async build(maxPatients = 25): Promise<SmartClinicalNotification[]> {
    const patients = (await firstValueFrom(this.api.listPatients())) || [];

    const alerts: SmartClinicalNotification[] = [];
    for (const patient of patients.slice(0, maxPatients)) {
      const patientId = patient.id;
      if (!patientId) continue;
      const [findings, completion] = await Promise.all([
        this.quality.evaluatePatient(patientId).catch(() => []),
        this.completeness.evaluate(patientId, 'follow_up').catch(() => null),
      ]);

      findings.slice(0, 3).forEach((finding) => alerts.push({
        id: `quality-${patientId}-${finding.code}-${finding.entityId || 'chart'}`,
        patientId,
        patientName: patient.name || patient.displayName || 'Patient',
        mrn: patient.mrn || null,
        severity: finding.severity,
        title: finding.title,
        message: finding.message,
        actionRoute: ['/tabs','skin-wound',patientId,'assessments'],
      }));

      if (completion && completion.missingRequired.length) {
        alerts.push({
          id: `complete-${patientId}`,
          patientId,
          patientName: patient.name || patient.displayName || 'Patient',
          mrn: patient.mrn || null,
          severity: 'warning',
          title: 'Visit documentation incomplete',
          message: `${completion.missingRequired.length} required section(s) still need documentation.`,
          actionRoute: ['/tabs','skin-wound',patientId,'assessments'],
        });
      }
    }
    return alerts.sort((a, b) => this.rank(b.severity) - this.rank(a.severity));
  }

  private rank(value: SmartClinicalNotification['severity']): number {
    return value === 'high' ? 3 : value === 'warning' ? 2 : 1;
  }
}
