import { Injectable, inject } from '@angular/core';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
} from 'firebase/firestore';

import { auth, db } from '../firebase';
import { PatientAssessmentService } from './patient-assessment.service';
import { latestAssessmentPerWound, resolveWoundId } from '../shared/wound-identity';
import { ClinicalVisitLink, matchesClinicalVisitLink } from '../shared/clinical-visit-link';
import {
  WoundNoteEducation,
  WoundNoteInput,
  WoundNoteOrder,
  WoundNoteWound,
  WoundNoteVisitKind,
  defaultReasonForConsult,
  defaultRecommendation,
} from '../shared/wound-progress-note';

/**
 * Gathers everything the wound progress note is built from.
 *
 * Nothing here is typed by the nurse a second time: the wounds come from the
 * assessments they just recorded, the orders from the chart, the Braden from
 * the score they just took, the education from what they just documented.
 * Two things are theirs to choose -- why the consult happened and what the
 * recommendation is -- and those are asked on the screen.
 *
 * Built on the plain modular SDK (auth/db from ../firebase) for the reason
 * recorded in a713a49d.
 */

export interface WoundNoteSnapshot extends WoundNoteInput {
  /** True when this patient has no assessment older than this visit. */
  firstVisit: boolean;
}

@Injectable({ providedIn: 'root' })
export class WoundProgressNoteService {
  private assessments = inject(PatientAssessmentService);

  async gather(
    patientId: string,
    now: Date = new Date(),
    visitLink: ClinicalVisitLink = {}
  ): Promise<WoundNoteSnapshot> {
    if (!patientId) throw new Error('WoundProgressNoteService.gather(): patientId is missing.');

    const user = auth.currentUser;
    const [patient, assessments, orders, braden, education] = await Promise.all([
      this.readPatient(patientId),
      this.readAssessments(patientId, visitLink),
      this.readOrders(patientId, visitLink),
      this.readBraden(patientId, visitLink),
      this.readEducation(patientId, visitLink),
    ]);

    const current = latestAssessmentPerWound(assessments);

    // A visit is an admission when this patient has no wound assessment
    // predating today's. Offered as a default, not enforced -- a patient
    // readmitted after a gap is an admission again, and only the clinician
    // knows that.
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const firstVisit = !assessments.some(
      (a) => (a.assessedAt?.getTime() ?? Infinity) < startOfDay.getTime());
    const visitKind: WoundNoteVisitKind = firstVisit ? 'admission' : 'follow_up';

    const ordersByWound = new Map<string, WoundNoteOrder[]>();
    for (const order of orders) {
      const key = order.woundId ?? '';
      const existing = ordersByWound.get(key) ?? [];
      existing.push(order.note);
      ordersByWound.set(key, existing);
    }

    return {
      visitKind,
      firstVisit,
      reasonForConsult: defaultReasonForConsult(visitKind),
      recommendation: defaultRecommendation(visitKind),
      patient,
      bradenTotal: braden?.total ?? null,
      bradenRiskText: braden?.riskText ?? null,
      wounds: current.map((assessment) => this.toNoteWound(assessment, ordersByWound)),
      education,
      recordedByName: user?.displayName || user?.email || 'Clinician',
      recordedAt: now,
    };
  }

  private toNoteWound(
    assessment: any,
    ordersByWound: Map<string, WoundNoteOrder[]>,
  ): WoundNoteWound {
    const woundId = resolveWoundId(assessment) ?? '';
    return {
      woundId,
      type: assessment.describe?.type ?? assessment.type ?? '',
      location: assessment.describe?.location ?? assessment.location ?? '',
      acquired: assessment.describe?.acquired ?? null,
      stage: assessment.describe?.stage ?? null,
      firstAssessedAt: assessment.firstAssessedAt ?? null,
      assessedAt: assessment.assessedAt ?? null,
      measurements: {
        length: this.numOrNull(assessment.measurements?.length),
        width: this.numOrNull(assessment.measurements?.width),
        depth: this.numOrNull(assessment.measurements?.depth),
        area: this.numOrNull(assessment.measurements?.area),
        volume: this.numOrNull(assessment.measurements?.volume),
        undermining: assessment.measurements?.undermining || null,
        tunneling: assessment.measurements?.tunneling || null,
      },
      woundBed: assessment.woundBed ?? null,
      exudate: assessment.exudate ?? null,
      periwound: assessment.periwound ?? null,
      pain: assessment.pain ?? null,
      progress: assessment.progress ?? null,
      treatment: assessment.treatment ?? null,
      goalOfCare: assessment.orders?.goalOfCare ?? null,
      // Orders filed against this wound, plus the patient-level ones, which
      // are about every wound and would otherwise appear against none.
      orders: [
        ...(ordersByWound.get(woundId) ?? []),
        ...(ordersByWound.get('') ?? []),
      ],
    };
  }

  private bradenRiskLabel(total: number): string {
    if (total <= 9) return 'Very high risk';
    if (total <= 12) return 'High risk';
    if (total <= 14) return 'Moderate risk';
    if (total <= 18) return 'At risk';
    return 'Low risk';
  }

  private numOrNull(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  private toDate(value: any): Date | null {
    if (!value) return null;
    if (typeof value?.toDate === 'function') return value.toDate();
    if (value instanceof Date) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private async readPatient(patientId: string) {
    try {
      const snap = await getDoc(doc(db, 'patients', patientId));
      const data: any = snap.data() ?? {};
      return {
        name: data.name || data.displayName || 'Patient',
        dob: data.dob ?? null,
        gender: data.gender ?? null,
        diagnoses: Array.isArray(data.diagnoses) ? data.diagnoses : [],
        allergies: Array.isArray(data.allergies) ? data.allergies : [],
        // Absent from the patient model today. Left null so the note prints
        // "on file" wording rather than inventing a history.
        pastMedicalHistory: data.pastMedicalHistory ?? null,
        pastSurgicalHistory: data.pastSurgicalHistory ?? null,
      };
    } catch {
      return { name: 'Patient', dob: null, gender: null, diagnoses: [], allergies: [] };
    }
  }

  private async readAssessments(patientId: string, visitLink: ClinicalVisitLink): Promise<any[]> {
    const snap = await getDocs(collection(db, `patients/${patientId}/woundAssessments`));
    return snap.docs.map((d) => {
      const data: any = d.data();
      return {
        ...data,
        id: d.id,
        assessedAt: this.toDate(data.assessedAt) ?? this.toDate(data.createdAt),
        firstAssessedAt: this.toDate(data.createdAt),
      };
    }).filter((row) =>
      !visitLink.visitId && !visitLink.appointmentId
        ? true
        : matchesClinicalVisitLink(row, visitLink)
    );
  }

  private async readOrders(patientId: string, visitLink: ClinicalVisitLink): Promise<Array<{ woundId: string | null; note: WoundNoteOrder }>> {
    try {
      const snap = await getDocs(collection(db, `patients/${patientId}/orders`));
      return snap.docs
        .map((d) => {
          const data: any = d.data();
          return {
            raw: { ...data, id: d.id },
            woundId: typeof data.woundId === 'string' ? data.woundId : null,
            state: data.workflow?.state ?? null,
            note: {
              orderedAt: this.toDate(data.orderedAt) ?? this.toDate(data.createdAt),
              orderType: data.orderType || '',
              description: data.description || '',
              orderedByName: data.orderedBy?.displayName || '',
            } as WoundNoteOrder,
          };
        })
        // Archived orders are not active orders. A note that lists a
        // discontinued dressing tells the next clinician to keep applying it.
        .filter((row) =>
          row.state !== 'archived' &&
          row.note.description &&
          (!visitLink.visitId && !visitLink.appointmentId
            ? true
            : matchesClinicalVisitLink(row.raw, visitLink))
        )
        .map(({ woundId, note }) => ({ woundId, note }));
    } catch {
      return [];
    }
  }

  private async readBraden(patientId: string, visitLink: ClinicalVisitLink) {
    try {
      const snap = await getDocs(collection(db, `patients/${patientId}/assessments`));
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((row: any) =>
          row.kind === 'braden' &&
          (!visitLink.visitId && !visitLink.appointmentId
            ? true
            : matchesClinicalVisitLink(row, visitLink))
        )
        .sort((a: any, b: any) =>
          (this.toDate(b.assessedAt || b.createdAt)?.getTime() ?? 0) -
          (this.toDate(a.assessedAt || a.createdAt)?.getTime() ?? 0)
        );
      const row: any = rows[0];
      if (!row) return null;
      const braden = row.answers?.braden ?? row.braden ?? {};
      const total = typeof row.score === 'number' ? row.score : null;
      return { total, riskText: total == null ? null : this.bradenRiskLabel(total), braden };
    } catch {
      return null;
    }
  }

  private async readEducation(patientId: string, visitLink: ClinicalVisitLink): Promise<WoundNoteEducation[]> {
    try {
      const q = query(
        collection(db, `patients/${patientId}/educationRecords`),
        orderBy('deliveredAt', 'desc'),
        limit(10),
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const data: any = d.data();
        return {
          raw: { ...data, id: d.id },
          topic: data.topic || '',
          learners: Array.isArray(data.learners) ? data.learners : [],
          response: Array.isArray(data.response) ? data.response : [],
        };
      }).filter((entry) =>
        !!entry.topic &&
        (!visitLink.visitId && !visitLink.appointmentId
          ? true
          : matchesClinicalVisitLink(entry.raw, visitLink))
      ).map(({ topic, learners, response }) => ({ topic, learners, response }));
    } catch {
      return [];
    }
  }
}
