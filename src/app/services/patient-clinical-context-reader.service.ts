import { Injectable } from '@angular/core';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export type MobileClinicalContextKind = 'diagnostic' | 'medicalHistory' | 'allergy';

export interface MobileClinicalContextFact {
  id: string;
  kind: MobileClinicalContextKind;
  code: string | null;
  description: string;
  status: string | null;
  reviewStatus: string | null;
  primary: boolean;
  rank: number | null;
  reaction: string | null;
  severity: string | null;
  sourceReference: string | null;
}

export interface MobileClinicalContext {
  diagnoses: MobileClinicalContextFact[];
  medicalHistory: MobileClinicalContextFact[];
  allergies: MobileClinicalContextFact[];
  intakeDiagnoses: string[];
  intakeAllergies: string[];
  intakeMedicalHistory: string[];
}

/**
 * Read-only bridge to the canonical JADE patient clinical-context collections.
 * WoundAPP never invents or silently copies these facts into a progress note.
 * The clinician sees the current chart context while documenting and remains
 * responsible for the content they author in the note.
 */
@Injectable({ providedIn: 'root' })
export class PatientClinicalContextReaderService {
  async load(patientId: string): Promise<MobileClinicalContext> {
    if (!patientId) throw new Error('Patient context requires a patientId.');

    const [diagnoses, medicalHistory, allergies, patientSnap] = await Promise.all([
      this.read(patientId, 'diagnostic'),
      this.read(patientId, 'medicalHistory'),
      this.read(patientId, 'allergy'),
      getDoc(doc(db, 'patients', patientId)),
    ]);
    const patient = patientSnap.exists() ? patientSnap.data() as Record<string, any> : {};
    const intake = patient['clinical'] || {};

    return {
      intakeDiagnoses: this.intakeTexts(patient['diagnoses'] ?? intake['diagnoses']),
      intakeAllergies: this.intakeTexts(patient['allergies'] ?? intake['allergies']),
      intakeMedicalHistory: this.intakeTexts(patient['medicalHistory'] ?? intake['medicalHistory']),
      // Only provider-approved diagnoses are shown as established diagnoses.
      diagnoses: diagnoses
        .filter((row) => row.reviewStatus === 'approved' && row.status !== 'entered_in_error')
        .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999)),
      medicalHistory: medicalHistory
        .filter((row) => row.status !== 'entered_in_error')
        .sort((a, b) => a.description.localeCompare(b.description)),
      allergies: allergies
        .filter((row) => row.status !== 'entered_in_error')
        .sort((a, b) => a.description.localeCompare(b.description)),
    };
  }

  private async read(patientId: string, kind: MobileClinicalContextKind): Promise<MobileClinicalContextFact[]> {
    const snapshot = await getDocs(collection(db, `patients/${patientId}/${kind}`));
    return snapshot.docs.map((document) => {
      const data = document.data() as any;
      return {
        id: document.id,
        kind,
        code: this.text(data.code),
        description: this.text(data.description || data.name) || 'Description not recorded',
        status: this.text(data.status),
        reviewStatus: this.text(data.reviewStatus),
        primary: data.primary === true,
        rank: Number.isInteger(data.rank) ? Number(data.rank) : null,
        reaction: this.text(data.reaction),
        severity: this.text(data.severity),
        sourceReference: this.text(data.sourceReference),
      };
    });
  }

  private intakeTexts(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.map(item =>
      typeof item === 'string' ? item.trim() :
      item && typeof item === 'object' ? this.text((item as any).description || (item as any).name) : null
    ).filter((item): item is string => !!item))];
  }

  private text(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }
}
