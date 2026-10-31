import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonSelect,
  IonSelectOption,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addCircleOutline, trashOutline } from 'ionicons/icons';

import {
  ClinicalCoding,
  ClinicalCodingActor,
  ClinicalCodingIssue,
  ClinicalDiagnosisCode,
  ClinicalProcedureCode,
  emptyClinicalCoding,
  isDebridementCode,
  isEvaluationAndManagementCode,
  normalizeClinicalCode,
  procedureCodeSystem,
  suggestedDebridementUnits,
  validateClinicalCoding,
} from './clinical-coding';
import { cptCodingEnabled } from './billing-capabilities';

export interface WoundCodingChartDiagnosis { id: string; code: string; description?: string | null; }

/**
 * Diagnosis & Procedure Coding for the wound on this assessment.
 *
 * Writes the shared clinicalCoding schema (shared/clinical-coding.ts, the
 * same file JADE-SHOP reads). There is no code catalog on the device:
 * ICD-10-CM and CPT/HCPCS are entered by number, checked for format, and
 * marked manual for coding review in JADE. An RN's entries are proposals; a
 * provider's are confirmed. E/M services belong to the provider's visit note,
 * so this wound-level section does not offer them.
 */
@Component({
  selector: 'app-wound-coding-section',
  standalone: true,
  imports: [CommonModule, FormsModule, IonButton, IonIcon, IonInput, IonItem, IonLabel, IonNote, IonSelect, IonSelectOption],
  template: `
    <div class="coding">
      <p class="intro" *ngIf="procedureCodingEnabled">Record the ICD-10-CM diagnoses you assessed for this wound and any CPT/HCPCS procedure you performed on it. Billing review happens in JADE.</p>
      <p class="intro" *ngIf="!procedureCodingEnabled">Record the ICD-10-CM diagnoses you assessed for this wound. Document any procedure in the Debridement section in your own words; the billing partner assigns procedure codes from the signed record.</p>

      <div class="head"><strong>Diagnoses</strong>
        <ion-button size="small" fill="outline" (click)="addDiagnosis()" [disabled]="disabled"><ion-icon slot="start" name="add-circle-outline"></ion-icon>Diagnosis</ion-button>
      </div>
      <div class="reuse" *ngIf="availableChartDiagnoses.length && !disabled">
        <ion-note>Approved on the chart:</ion-note>
        <ion-button size="small" fill="clear" *ngFor="let dx of availableChartDiagnoses" (click)="addDiagnosis(dx)">{{ dx.code }}</ion-button>
      </div>
      <ion-note *ngIf="!model.diagnoses.length">No diagnosis recorded.</ion-note>
      <div class="row" *ngFor="let row of model.diagnoses; let i = index; trackBy: trackCodingRow">
        <ion-item>
          <ion-label position="stacked">ICD-10-CM code</ion-label>
          <ion-input [ngModel]="row.code" (ngModelChange)="onDiagnosisCode(row, $event)" placeholder="e.g. L89.153" autocapitalize="characters" [disabled]="disabled"></ion-input>
        </ion-item>
        <ion-item>
          <ion-label position="stacked">Description</ion-label>
          <ion-input [(ngModel)]="row.description" (ngModelChange)="emit()" [disabled]="disabled"></ion-input>
        </ion-item>
        <ion-item>
          <ion-label position="stacked">Status</ion-label>
          <ion-select [(ngModel)]="row.status" (ionChange)="emit()" interface="popover" [disabled]="disabled">
            <ion-select-option value="proposed">Proposed</ion-select-option>
            <ion-select-option value="provider_confirmed" [disabled]="!providerAuthor">Provider confirmed</ion-select-option>
            <ion-select-option value="rejected">Ruled out</ion-select-option>
          </ion-select>
        </ion-item>
        <div class="row-foot">
          <ion-note>{{ row.codeSource === 'chart_diagnosis' ? 'From the approved chart diagnosis' : 'Entered manually · verified at coding review' }}</ion-note>
          <ion-button size="small" fill="clear" color="danger" (click)="removeDiagnosis(i)" [disabled]="disabled" [attr.aria-label]="'Remove diagnosis ' + (i + 1)"><ion-icon name="trash-outline"></ion-icon></ion-button>
        </div>
        <ion-note *ngFor="let issue of issuesFor('diagnoses.' + i + '.')" [color]="issue.level === 'error' ? 'danger' : 'warning'">{{ issue.message }}</ion-note>
      </div>

      <ng-container *ngIf="procedureCodingEnabled">
      <div class="head"><strong>Procedures on this wound</strong>
        <ion-button size="small" fill="outline" (click)="addProcedure()" [disabled]="disabled"><ion-icon slot="start" name="add-circle-outline"></ion-icon>Procedure</ion-button>
      </div>
      <ion-note *ngIf="!model.procedures.length">No procedure recorded.</ion-note>
      <div class="row" *ngFor="let row of model.procedures; let i = index; trackBy: trackCodingRow">
        <ion-item>
          <ion-label position="stacked">CPT / HCPCS code</ion-label>
          <ion-input [ngModel]="row.code" (ngModelChange)="onProcedureCode(row, $event)" placeholder="e.g. 97597" autocapitalize="characters" [disabled]="disabled"></ion-input>
        </ion-item>
        <ion-item>
          <ion-label position="stacked">Description (your words)</ion-label>
          <ion-input [(ngModel)]="row.description" (ngModelChange)="emit()" [disabled]="disabled"></ion-input>
        </ion-item>
        <ion-item>
          <ion-label position="stacked">Units</ion-label>
          <ion-input type="number" min="1" step="1" [(ngModel)]="row.units" (ngModelChange)="emit()" [disabled]="disabled"></ion-input>
        </ion-item>
        <ion-item *ngIf="activeDiagnoses.length">
          <ion-label position="stacked">For diagnosis</ion-label>
          <ion-select multiple [(ngModel)]="row.diagnosisIds" (ionChange)="emit()" [disabled]="disabled">
            <ion-select-option *ngFor="let dx of activeDiagnoses" [value]="dx.id">{{ dx.code || '—' }}</ion-select-option>
          </ion-select>
        </ion-item>
        <ion-note *ngIf="suggestedUnits(row) as suggestion">
          The documented debrided area ({{ suggestion.area }} cm²) supports {{ suggestion.units }} unit(s).
          <ion-button size="small" fill="clear" *ngIf="suggestion.units > 0 && suggestion.units !== row.units && !disabled" (click)="applySuggestedUnits(row)">Use {{ suggestion.units }}</ion-button>
        </ion-note>
        <div class="row-foot">
          <ion-note>Entered by number · unverified until coding review</ion-note>
          <ion-button size="small" fill="clear" color="danger" (click)="removeProcedure(i)" [disabled]="disabled" [attr.aria-label]="'Remove procedure ' + (i + 1)"><ion-icon name="trash-outline"></ion-icon></ion-button>
        </div>
        <ion-note *ngFor="let issue of issuesFor('procedures.' + i + '.')" [color]="issue.level === 'error' ? 'danger' : 'warning'">{{ issue.message }}</ion-note>
      </div>
      </ng-container>
      <ion-note class="disclaimer">Entering a code does not establish medical necessity. The claim still needs the signed documentation behind it.</ion-note>
    </div>
  `,
  styles: [`
    .coding{display:grid;gap:8px;padding:8px 12px 12px}
    .intro{margin:0;font-size:12px;color:#5b6f7c}
    .head{display:flex;justify-content:space-between;align-items:center;margin-top:8px}
    .reuse{display:flex;flex-wrap:wrap;align-items:center;gap:4px}
    .row{display:grid;gap:2px;padding:8px;border:1px solid #e3ecef;border-radius:12px;background:#fff}
    .row-foot{display:flex;justify-content:space-between;align-items:center}
    ion-note{font-size:12px}
    .disclaimer{display:block;margin-top:4px}
  `],
})
export class WoundCodingSectionComponent implements OnChanges {
  @Input() coding: ClinicalCoding | null = null;
  /** The wound this assessment documents (or a placeholder for a new wound). */
  @Input() woundId = '';
  /** Present when this assessment documents a debridement. */
  @Input() debridementAreaCm2: number | null = null;
  @Input() debridementDocumented = false;
  @Input() chartDiagnoses: WoundCodingChartDiagnosis[] = [];
  @Input() actor: ClinicalCodingActor | null = null;
  @Input() providerAuthor = false;
  @Input() serviceDate: string | null = null;
  @Input() disabled = false;
  @Output() codingChange = new EventEmitter<ClinicalCoding>();

  model: ClinicalCoding = emptyClinicalCoding();
  issues: ClinicalCodingIssue[] = [];
  /**
   * Clinical-only production mode: no CPT/HCPCS entry and no CPT unit
   * suggestion. Procedure rows already on a record are kept untouched.
   */
  readonly procedureCodingEnabled = cptCodingEnabled();

  // Autosave/parent echoes clone rows; retain their controls and keyboard focus.
  trackCodingRow(index: number, row: { id: string }): string | number {
    return row.id || index;
  }

  constructor() {
    addIcons({ addCircleOutline, trashOutline });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['coding']) {
      const source = this.coding ?? emptyClinicalCoding();
      this.model = {
        ...source,
        diagnoses: source.diagnoses.map((row) => ({ ...row })),
        procedures: source.procedures.map((row) => ({ ...row, diagnosisIds: [...(row.diagnosisIds ?? [])] })),
      };
    }
    if (changes['woundId']) {
      // Rows always belong to this assessment's wound.
      this.model.diagnoses.forEach((row) => row.woundId = this.woundId || row.woundId);
      this.model.procedures.forEach((row) => row.woundId = this.woundId || row.woundId);
    }
    this.validate();
  }

  get activeDiagnoses(): ClinicalDiagnosisCode[] {
    return this.model.diagnoses.filter((row) => row.status !== 'rejected');
  }

  get availableChartDiagnoses(): WoundCodingChartDiagnosis[] {
    const taken = new Set(this.model.diagnoses.map((row) => normalizeClinicalCode(row.code)));
    return this.chartDiagnoses.filter((row) => !taken.has(normalizeClinicalCode(row.code)));
  }

  addDiagnosis(from?: WoundCodingChartDiagnosis): void {
    this.model.diagnoses.push({
      id: this.newId('dx'),
      codeSystem: 'ICD-10-CM',
      code: from ? normalizeClinicalCode(from.code) : '',
      description: from?.description ?? null,
      woundId: this.woundId || null,
      codeSource: from ? 'chart_diagnosis' : 'manual',
      chartDiagnosisId: from?.id ?? null,
      status: this.providerAuthor ? 'provider_confirmed' : 'proposed',
      recordedBy: this.actor,
      recordedAtIso: new Date().toISOString(),
    });
    this.emit();
  }

  addProcedure(): void {
    if (!this.procedureCodingEnabled) return;
    this.model.procedures.push({
      id: this.newId('px'),
      codeSystem: 'CPT',
      code: '',
      description: null,
      scope: 'wound',
      woundId: this.woundId || null,
      procedureDate: this.serviceDate,
      procedureType: null,
      units: 1,
      diagnosisIds: [],
      debridementProcedureId: null,
      renderingProviderUid: this.providerAuthor ? this.actor?.uid ?? null : null,
      codeSource: 'manual',
      status: this.providerAuthor ? 'provider_confirmed' : 'proposed',
      recordedBy: this.actor,
      recordedAtIso: new Date().toISOString(),
    });
    this.emit();
  }

  removeDiagnosis(index: number): void {
    const [removed] = this.model.diagnoses.splice(index, 1);
    if (removed) this.model.procedures.forEach((row) => row.diagnosisIds = row.diagnosisIds.filter((id) => id !== removed.id));
    this.emit();
  }

  removeProcedure(index: number): void {
    this.model.procedures.splice(index, 1);
    this.emit();
  }

  onDiagnosisCode(row: ClinicalDiagnosisCode, value: unknown): void {
    row.code = normalizeClinicalCode(value);
    row.codeSource = 'manual';
    row.chartDiagnosisId = null;
    this.emit();
  }

  onProcedureCode(row: ClinicalProcedureCode, value: unknown): void {
    row.code = normalizeClinicalCode(value);
    row.codeSystem = procedureCodeSystem(row.code) ?? 'CPT';
    row.codeSource = 'manual';
    row.scope = 'wound';
    row.woundId = this.woundId || row.woundId;
    // The facts behind a debridement code are this assessment's own procedure.
    row.debridementProcedureId = isDebridementCode(row.code) && this.debridementDocumented ? 'assessment' : null;
    this.emit();
  }

  suggestedUnits(row: ClinicalProcedureCode): { units: number; area: number } | null {
    if (!this.procedureCodingEnabled || !this.debridementDocumented) return null;
    const area = Number(this.debridementAreaCm2);
    const units = suggestedDebridementUnits(row.code, area);
    return units == null ? null : { units, area };
  }

  applySuggestedUnits(row: ClinicalProcedureCode): void {
    const suggestion = this.suggestedUnits(row);
    if (suggestion && suggestion.units > 0) { row.units = suggestion.units; this.emit(); }
  }

  issuesFor(field: string): ClinicalCodingIssue[] {
    return this.issues.filter((issue) => issue.field.startsWith(field));
  }

  /** Errors that must be fixed before the assessment is saved. */
  blockingIssues(): string[] {
    this.validate();
    return this.issues.filter((issue) => issue.level === 'error').map((issue) => issue.message);
  }

  emit(): void {
    this.validate();
    this.codingChange.emit({
      ...this.model,
      diagnoses: this.model.diagnoses.map((row) => ({ ...row, description: row.description || null })),
      procedures: this.model.procedures.map((row) => ({ ...row, units: Number(row.units) || 0, description: row.description || null })),
    });
  }

  private validate(): void {
    const extra: ClinicalCodingIssue[] = this.model.procedures
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => row.status !== 'rejected' && isEvaluationAndManagementCode(row.code))
      .map(({ row, index }) => ({
        level: 'error' as const,
        field: `procedures.${index}.code`,
        message: `Procedure ${index + 1}: ${row.code} is an E/M visit service; the provider records it in the visit note, not on a wound.`,
      }));
    this.issues = [
      ...validateClinicalCoding(this.model, {
        woundIds: this.woundId ? [this.woundId] : [],
        debridementProcedureIds: this.debridementDocumented ? ['assessment'] : [],
        debridementProcedureWounds: this.debridementDocumented && this.woundId ? { assessment: this.woundId } : {},
      }).filter((issue) => !extra.some((item) => item.field === issue.field && /evaluation and management/.test(issue.message))),
      ...extra,
      // Hidden historical procedure rows never block saving in clinical-only mode.
    ].filter((issue) => this.procedureCodingEnabled || !issue.field.startsWith('procedures.'));
  }

  private newId(prefix: string): string {
    return `${prefix}-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now().toString(36)}`;
  }
}
