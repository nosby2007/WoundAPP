// src/app/pages/assessment-form/assessment-form.page.ts
import { Component, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ToastController,
  IonAccordion,
  IonAccordionGroup,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCheckbox,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonRange,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import { camera, flash, images } from 'ionicons/icons';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { Camera, CameraDirection, CameraResultType, CameraSource } from '@capacitor/camera';
import { AssessmentsService } from '../../services/assessments.service';
import { ClinicalDraftService } from '../../services/clinical-draft.service';
import { WoundRoundMobileService } from '../../services/wound-round.service';
import { getAuth } from 'firebase/auth';
import { take } from 'rxjs/operators';
import { Subscription } from 'rxjs';

import {
  ACQUIRED,
  ADDITIONAL_CARE,
  CLEANSING,
  DEBRIDEMENT,
  DRESSING_APPEARANCE,
  EDEMA,
  EDGES,
  EXUDATE_AMOUNTS,
  EXUDATE_TYPES,
  INDURATION,
  GOALS_OF_CARE,
  INFECTION_SIGNS,
  INFECTION_STATUS,
  MODALITIES,
  ODORS,
  PAIN_FREQUENCY,
  PRIMARY_DRESSINGS,
  SECONDARY_DRESSINGS,
  STAGES,
  STATUS,
  SURROUNDING,
  TEMPERATURE,
  TUNNELING,
  UNDERMINING,
  WOUND_OTHER,
  WOUND_TYPES,
} from 'src/app/shared/wound-vocabulary';
import { buildWoundTreatment } from 'src/app/shared/wound-treatment';
import { assessmentDebridementGroup, assessmentDebridementPayload } from '../../shared/assessment-debridement';
import {
  stripWoundIdForUpdate,
  woundIdForCreate,
} from 'src/app/shared/wound-identity';
import { clinicalVisitQueryParams } from 'src/app/shared/clinical-visit-link';
import { assessmentStageFromRecord, stageForWoundType } from '../../shared/wound-stage';
import { ClinicalCoding, ClinicalCodingActor, clinicalCodingOf } from '../../shared/clinical-coding';
import { WoundCodingChartDiagnosis, WoundCodingSectionComponent } from '../../shared/wound-coding-section.component';
import { ClinicalIdentityService } from '../../services/clinical-identity.service';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { WoundBodyMapComponent } from '../../shared/wound-body-map.component';
import { bodyProfileFromPatientGender, BodyProfile, normalizeWoundAnatomy, positionForZone, WoundAnatomyPosition } from '../../shared/wound-anatomy';

/** Stands in for a new wound's id until the assessment id is allocated on save. */
const THIS_WOUND = 'this-wound';

/**
 * A wound assessment, as recorded at the bedside.
 *
 * This form used to ask five questions -- type, stage, location, acquired,
 * status -- while the document it saved carried the web app's full
 * WoundAssessment shape. Everything it did not ask, it filled in anyway:
 * measurements of 0, exudate 'None', pain 0, infection 'None', peri-wound
 * 'Normal', no granulation, no slough. Those are not blanks. They are
 * negative clinical findings, written into the chart over a nurse's name,
 * for questions nobody was asked -- and 0 x 0 x 0 cm is the one number a
 * wound is tracked by.
 *
 * Every section the payload writes is now a section the nurse can fill in.
 * The lists come from shared/wound-vocabulary.ts, which is copied from the
 * web app's own form rather than written here.
 */
@Component({
  selector: 'app-assessment-form',
  standalone: true,
  templateUrl: './assessment-form.page.html',
  styleUrls: ['./assessment-form.page.scss'],
  imports: [
    CommonModule, ReactiveFormsModule, RouterModule,
    IonAccordion,
    IonAccordionGroup,
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCheckbox,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonNote,
    IonRange,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonTextarea,
    IonTitle,
    IonToolbar,
    WoundCodingSectionComponent,
    WoundBodyMapComponent,
  ],
})
export class AssessmentFormPage implements OnInit, OnDestroy {
  @ViewChild(WoundCodingSectionComponent) private codingSection?: WoundCodingSectionComponent;
  private clinicalIdentity = inject(ClinicalIdentityService);

  // ---- Diagnosis & Procedure Coding (shared/clinical-coding.ts)
  coding: ClinicalCoding | null = null;
  codingErrors: string[] = [];
  codingActor: ClinicalCodingActor | null = null;
  providerAuthor = false;
  chartDiagnoses: WoundCodingChartDiagnosis[] = [];
  /** A signed, locked assessment is frozen; corrections are made in JADE by amendment. */
  codingLocked = false;
  readonly todayIso = new Date().toISOString().slice(0, 10);

  get codingWoundId(): string {
    return this.woundId || THIS_WOUND;
  }

  onCodingChange(coding: ClinicalCoding): void {
    this.coding = coding;
    this.codingErrors = [];
    if (!this.restoringDraft) this.scheduleDraft();
  }

  private async loadCodingContext(): Promise<void> {
    try {
      const identity = await this.clinicalIdentity.requireCurrentIdentity();
      this.codingActor = { uid: identity.uid, displayName: identity.displayName ?? null, role: identity.role ?? null, credentials: identity.credentials ?? null };
      const roles = [identity.role, ...(identity.roles || [])].map((role) => String(role || '').toLowerCase());
      this.providerAuthor = roles.some((role) => ['provider', 'np', 'md', 'do', 'physician'].includes(role));
    } catch { this.codingActor = null; }
    try {
      const snap = await getDocs(collection(db, `patients/${this.patientId}/diagnostic`));
      this.chartDiagnoses = snap.docs
        .map((item) => ({ id: item.id, ...(item.data() as any) }))
        .filter((row: any) => row.reviewStatus === 'approved' && row.status !== 'entered_in_error' && row.code)
        .map((row: any) => ({ id: row.id, code: String(row.code), description: row.description || null }));
    } catch { this.chartDiagnoses = []; }
  }

  /** The coding block as stored: every row belongs to this assessment's wound. */
  private codingForSave(woundId: string): ClinicalCoding | null {
    if (!this.coding || (!this.coding.diagnoses.length && !this.coding.procedures.length)) return null;
    const own = (id: string | null) => (!id || id === THIS_WOUND ? woundId : id);
    return {
      ...this.coding,
      diagnoses: this.coding.diagnoses.map((row) => ({ ...row, woundId: own(row.woundId) })),
      procedures: this.coding.procedures.map((row) => ({ ...row, woundId: own(row.woundId) })),
    };
  }
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private assessments = inject(AssessmentsService);
  private rounds = inject(WoundRoundMobileService);
  private toastCtrl = inject(ToastController);
  private drafts = inject(ClinicalDraftService);

  patientId = this.route.snapshot.paramMap.get('patientId')!;
  assessmentId = this.route.snapshot.paramMap.get('assessmentId'); // undefined = NEW

  /**
   * Round context is explicit and survives the entire assessment workflow.
   * The assessment remains a normal patient-chart record; roundId is only
   * used to link that saved source record back to the active wound round.
   */
  roundId = this.route.snapshot.queryParamMap.get('roundId');
  /** Scheduler/Frontdesk appointment context carried through the mobile field workflow. */
  appointmentId = this.route.snapshot.queryParamMap.get('appointmentId');
  /**
   * Schedule is the canonical physical encounter. Older routes used
   * woundVisitId for the same value; keep that only as a compatibility alias.
   * Never let a missing legacy alias strip the visit linkage from a bedside
   * assessment.
   */
  fieldEncounterVisitId =
    this.route.snapshot.queryParamMap.get('appointmentId') ||
    this.route.snapshot.queryParamMap.get('woundVisitId');

  /**
   * WHICH WOUND THIS ASSESSMENT IS OF.
   *
   * The web app groups a patient's wound timeline with
   *
   *   const woundId = assessment.woundId ?? assessment.id;   (wound-workflow.service.ts)
   *
   * so an assessment with no `woundId` is, to every reader, a wound of its
   * own. This form never wrote the field. The re-evaluation button has been
   * passing ?woundId= all along and nothing read it, so every re-evaluation
   * recorded in the field opened a NEW wound in the chart instead of adding
   * a point to the existing one's timeline -- and the registry's lazy
   * backfill then wrote a wounds/{id} document for the phantom, making it
   * permanent.
   *
   * Set from the query parameter on a re-evaluation, from the stored
   * document on an edit, and to the assessment's own id on a new wound --
   * which is the same value the fallback above computes, now stated rather
   * than inferred.
   */
  woundId: string | null = this.route.snapshot.queryParamMap.get('woundId');

  /** Display only, passed by the re-evaluate button so this screen can say
   *  which wound it is adding to without a second read. */
  woundLabel = this.route.snapshot.queryParamMap.get('woundLabel') || '';

  /** True when this form is adding a point to an existing wound's timeline
   *  rather than opening a new wound. */
  get isReevaluation(): boolean {
    return !this.assessmentId && !!this.woundId;
  }

  // Vocabularies, for the template.
  woundTypes = WOUND_TYPES;
  stages = STAGES;
  acquiredOptions = ACQUIRED;
  statusOptions = STATUS;
  underminingOptions = UNDERMINING;
  tunnelingOptions = TUNNELING;
  exudateAmounts = EXUDATE_AMOUNTS;
  exudateTypes = EXUDATE_TYPES;
  odorOptions = ODORS;
  infectionSigns = INFECTION_SIGNS;
  woundOtherOptions = WOUND_OTHER;
  edgeOptions = EDGES;
  surroundingOptions = SURROUNDING;
  indurationOptions = INDURATION;
  edemaOptions = EDEMA;
  temperatureOptions = TEMPERATURE;
  painFrequencyOptions = PAIN_FREQUENCY;
  infectionStatusOptions = INFECTION_STATUS;
  goalOfCareOptions = GOALS_OF_CARE;
  dressingAppearanceOptions = DRESSING_APPEARANCE;
  cleansingOptions = CLEANSING;
  debridementOptions = DEBRIDEMENT;
  primaryDressingOptions = PRIMARY_DRESSINGS;
  secondaryDressingOptions = SECONDARY_DRESSINGS;
  modalityOptions = MODALITIES;
  additionalCareOptions = ADDITIONAL_CARE;

  loading = false;
  draftStatus = '';
  private draftTimer?: ReturnType<typeof setTimeout>;
  private restoringDraft = false;
  private formChanges?: Subscription;
  private formRevision = 0;
  private assessmentSaved = false;
  private pendingDraftSave: Promise<void> = Promise.resolve();
  previousAssessmentId: string | null = null;
  previousAssessmentDate: Date | null = null;
  patientProfile: BodyProfile | null = null;
  private readonly stickerZoneId = this.route.snapshot.queryParamMap.get('anatomyZone') || '';
  private readonly stickerProfile = this.route.snapshot.queryParamMap.get('anatomyProfile');

  /**
   * Mirrors the web app's WoundAssessment form group, section for section, so
   * the two write the same document.
   *
   * Measurements start empty rather than at 0. An unrecorded measurement and
   * a wound that measures zero are different clinical statements, and the
   * second one means healed.
   */
  form = this.fb.group({
    describe: this.fb.group({
      type: ['Pressure', Validators.required],
      stage: [''],
      location: ['', Validators.required],
      anatomy: this.fb.control<WoundAnatomyPosition | null>(null),
      acquired: ['In-House Acquired'],
      notes: [''],
    }),
    measurements: this.fb.group({
      length: [null as number | null],
      width: [null as number | null],
      depth: [null as number | null],
      undermining: [''],
      tunneling: [''],
    }),
    woundBed: this.fb.group({
      epithelial: [false],
      granulationPresent: [false],
      granulationPercent: [null as number | null],
      sloughPresent: [false],
      sloughPercent: [null as number | null],
      eschar: [false],
      infection: this.fb.control<string[]>([]),
      other: this.fb.control<string[]>([]),
      otherNote: [''],
    }),
    exudate: this.fb.group({
      amount: ['None'],
      type: ['None'],
      odor: ['None'],
    }),
    periwound: this.fb.group({
      edges: ['Attached'],
      surrounding: this.fb.control<string[]>([]),
      induration: ['None present'],
      edema: ['No swelling or edema'],
      temperature: ['Normal'],
    }),
    pain: this.fb.group({
      cognitivelyImpaired: [false],
      score: [0],
      frequency: ['None'],
      notes: [''],
    }),
    progress: this.fb.group({
      status: ['New', Validators.required],
      infection: ['None'],
      notes: [''],
    }),
    /**
     * What was actually done to the wound at this visit.
     *
     * Every control starts EMPTY, unlike the web form, which opens on
     * 'Normal Saline' / 'Foam' / 'Film/Membrane'. Those defaults are
     * harmless at a desk where the section is always reviewed; here they
     * would write a dressing nobody applied into the chart of a nurse who
     * scrolled past. Nothing below is written unless it was chosen, and if
     * none of it was, the document carries no `treatment` at all -- which is
     * what "not recorded" looks like.
     */
    orders: this.fb.group({
      goalOfCare: [''],
    }),
    debridementProcedure: assessmentDebridementGroup(this.fb),
    treatment: this.fb.group({
      dressingAppearance: [''],
      cleansing: [''],
      debridement: [''],
      primary: [''],
      primaryOther: [''],
      secondary: [''],
      secondaryOther: [''],
      modalities: [''],
      additionalCare: this.fb.control<string[]>([]),
    }),
  });

  photoPreview?: string;
  private photoDataUrl?: string;

  constructor() {
    addIcons({ camera, flash, images });
  }

  /** Area and volume, computed the same way the web form computes them. */
  get area(): number | null {
    const l = this.form.value.measurements?.length;
    const w = this.form.value.measurements?.width;
    if (l == null || w == null) return null;
    return Number((Number(l) * Number(w)).toFixed(2));
  }

  get volume(): number | null {
    const l = this.form.value.measurements?.length;
    const w = this.form.value.measurements?.width;
    const d = this.form.value.measurements?.depth;
    if (l == null || w == null || d == null) return null;
    return Number((Number(l) * Number(w) * Number(d)).toFixed(2));
  }

  ngOnInit(): void {
    void this.loadCodingContext();
    this.assessments.getPatient(this.patientId).pipe(take(1)).subscribe(patient => {
      this.patientProfile = bodyProfileFromPatientGender(patient?.gender);
      this.applyStickerPosition();
    });
    this.formChanges?.unsubscribe();
    this.formChanges = this.form.valueChanges.subscribe(() => {
      this.formRevision++;
      this.normalizeStage();
      if (!this.restoringDraft) this.scheduleDraft();
    });

    if (this.assessmentId) {
      this.loadForEdit();
      return;
    }
    if (this.isReevaluation) {
      void this.loadReevaluationBaseline();
      return;
    }
    void this.restoreDraft().then(() => this.applyStickerPosition());
  }

  private applyStickerPosition(): void {
    if (!this.stickerZoneId || this.assessmentId || this.isReevaluation) return;
    const profile: BodyProfile = this.stickerProfile === 'male' || this.stickerProfile === 'female'
      ? this.stickerProfile
      : this.patientProfile || 'female';
    const position = positionForZone(this.stickerZoneId, profile);
    if (position) this.onAnatomyChange(position);
  }

  ngOnDestroy(): void {
    this.formChanges?.unsubscribe();
    if (this.draftTimer) clearTimeout(this.draftTimer);
    void this.persistDraft();
  }

  get isPressureWound(): boolean {
    return this.form.controls.describe.controls.type.value === 'Pressure';
  }

  clearStage(): void {
    const stage = this.form.controls.describe.controls.stage;
    stage.setValue('');
    stage.markAsDirty();
  }

  onAnatomyChange(position: WoundAnatomyPosition): void {
    const describe = this.form.controls.describe.controls;
    describe.anatomy.setValue(position);
    describe.location.setValue(position.label);
    describe.location.markAsDirty();
  }

  private normalizeStage(): void {
    const describe = this.form.controls.describe.controls;
    const stage = stageForWoundType(describe.type.value, describe.stage.value);
    if (describe.stage.value !== stage) describe.stage.setValue(stage, { emitEvent: false });
  }

  private async loadReevaluationBaseline(): Promise<void> {
    if (!this.woundId) return;
    this.loading = true;
    try {
      const data = await this.assessments.getLatestRawForWound(this.patientId, this.woundId);
      if (!data) return;

      this.previousAssessmentId = data.id ?? null;
      const rawDate = data.assessedAt ?? data.createdAt ?? null;
      this.previousAssessmentDate = rawDate?.toDate
        ? rawDate.toDate()
        : rawDate
          ? new Date(rawDate)
          : null;

      // Carry forward the last documented wound baseline so the clinician can
      // compare and update it. Visit-specific evidence is intentionally NOT
      // copied: photo, progress notes and treatment performed today start fresh.
      this.form.patchValue({
        describe: {
          type: data.describe?.type || data.type || '',
          stage: assessmentStageFromRecord(data),
          location: data.describe?.location || data.location || '',
          anatomy: normalizeWoundAnatomy(data.describe?.anatomy),
          acquired: data.describe?.acquired || data.acquired || '',
          notes: '',
        },
        measurements: {
          length: this.numOrNull(data.measurements?.length),
          width: this.numOrNull(data.measurements?.width),
          depth: this.numOrNull(data.measurements?.depth),
          undermining: data.measurements?.undermining || '',
          tunneling: data.measurements?.tunneling || '',
        },
        woundBed: {
          epithelial: !!data.woundBed?.epithelial,
          granulationPresent: !!data.woundBed?.granulation?.present,
          granulationPercent: this.numOrNull(data.woundBed?.granulation?.percent),
          sloughPresent: !!data.woundBed?.slough?.present,
          sloughPercent: this.numOrNull(data.woundBed?.slough?.percent),
          eschar: !!data.woundBed?.eschar,
          infection: data.woundBed?.infection || [],
          other: data.woundBed?.other || [],
          otherNote: data.woundBed?.otherNote || '',
        },
        exudate: {
          amount: data.exudate?.amount || 'None',
          type: data.exudate?.type || 'None',
          odor: data.exudate?.odor || 'None',
        },
        periwound: {
          edges: data.periwound?.edges || 'Attached',
          surrounding: data.periwound?.surrounding || [],
          induration: data.periwound?.induration || 'None present',
          edema: data.periwound?.edema || 'No swelling or edema',
          temperature: data.periwound?.temperature || 'Normal',
        },
        pain: {
          cognitivelyImpaired: !!data.pain?.cognitivelyImpaired,
          score: data.pain?.score ?? 0,
          frequency: data.pain?.frequency || 'None',
          notes: '',
        },
        progress: {
          status: data.progress?.status || data.status || 'New',
          infection: data.progress?.infection || 'None',
          notes: '',
        },
        orders: {
          goalOfCare: data.orders?.goalOfCare || '',
        },
        treatment: {
          dressingAppearance: '',
          cleansing: '',
          debridement: '',
          primary: '',
          primaryOther: '',
          secondary: '',
          secondaryOther: '',
          modalities: '',
          additionalCare: [],
        },
      });
    } catch (error) {
      console.error('[AssessmentForm] re-evaluation baseline load failed', error);
    } finally {
      this.loading = false;
      await this.restoreDraft();
    }
  }

  private loadForEdit() {
    this.loading = true;

    this.assessments
      .getRaw(this.patientId, this.assessmentId!)
      .pipe(take(1))
      .subscribe({
        next: (data) => {
          if (!data) {
            console.warn('[AssessmentForm] No doc found for edit', this.patientId, this.assessmentId);
            this.loading = false;
            return;
          }

          // Whatever the document already says. An edit must never re-derive
          // this: a re-evaluation carries its parent wound's id, and
          // recomputing it from the route would silently split the timeline
          // the edit was not even about.
          this.woundId = data.woundId ?? null;
          this.coding = clinicalCodingOf(data);
          this.codingLocked = data.locked === true || data.esign?.signed === true;

          this.form.patchValue({
            describe: {
              type: data.describe?.type || data.type || '',
              stage: assessmentStageFromRecord(data),
              location: data.describe?.location || data.location || '',
              anatomy: normalizeWoundAnatomy(data.describe?.anatomy),
              acquired: data.describe?.acquired || data.acquired || '',
              notes: data.describe?.notes || '',
            },
            measurements: {
              length: this.numOrNull(data.measurements?.length),
              width: this.numOrNull(data.measurements?.width),
              depth: this.numOrNull(data.measurements?.depth),
              undermining: data.measurements?.undermining || '',
              tunneling: data.measurements?.tunneling || '',
            },
            woundBed: {
              epithelial: !!data.woundBed?.epithelial,
              granulationPresent: !!data.woundBed?.granulation?.present,
              granulationPercent: this.numOrNull(data.woundBed?.granulation?.percent),
              sloughPresent: !!data.woundBed?.slough?.present,
              sloughPercent: this.numOrNull(data.woundBed?.slough?.percent),
              eschar: !!data.woundBed?.eschar,
              infection: data.woundBed?.infection || [],
              other: data.woundBed?.other || [],
              otherNote: data.woundBed?.otherNote || '',
            },
            exudate: {
              amount: data.exudate?.amount || 'None',
              type: data.exudate?.type || 'None',
              odor: data.exudate?.odor || 'None',
            },
            periwound: {
              edges: data.periwound?.edges || 'Attached',
              surrounding: data.periwound?.surrounding || [],
              induration: data.periwound?.induration || 'None present',
              edema: data.periwound?.edema || 'No swelling or edema',
              temperature: data.periwound?.temperature || 'Normal',
            },
            pain: {
              cognitivelyImpaired: !!data.pain?.cognitivelyImpaired,
              score: data.pain?.score ?? 0,
              frequency: data.pain?.frequency || 'None',
              notes: data.pain?.notes || '',
            },
            progress: {
              status: data.progress?.status || data.status || 'New',
              infection: data.progress?.infection || 'None',
              notes: data.progress?.notes || '',
            },
            orders: {
              goalOfCare: data.orders?.goalOfCare || '',
            },
            treatment: {
              dressingAppearance: data.treatment?.dressingAppearance || '',
              cleansing: data.treatment?.cleansing || '',
              debridement: data.treatment?.debridement || '',
              primary: data.treatment?.primary || '',
              primaryOther: data.treatment?.primaryOther || '',
              secondary: data.treatment?.secondary || '',
              secondaryOther: data.treatment?.secondaryOther || '',
              modalities: data.treatment?.modalities || '',
              additionalCare: data.treatment?.additionalCare || [],
            },
          });

          if (data.debridementProcedure) {
            this.form.controls.debridementProcedure.patchValue(data.debridementProcedure);
          }

          if (data.photoURL) {
            this.photoPreview = data.photoURL;
          }

          this.loading = false;
          void this.restoreDraft();
        },
        error: (err) => {
          console.error('[AssessmentForm] loadForEdit error', err);
          this.loading = false;
        },
      });
  }

  /** A stored 0 is a real measurement; a missing field is not. */
  private numOrNull(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  private draftKey() {
    const modeKey = this.assessmentId
      ? `edit:${this.assessmentId}`
      : this.woundId
        ? `reeval:${this.woundId}`
        : 'new';
    return {
      formKind: 'wound_assessment' as const,
      patientId: this.patientId,
      contextKey: [
        modeKey,
        this.fieldEncounterVisitId || this.appointmentId || 'no-visit',
      ].join(':'),
    };
  }

  private scheduleDraft(): void {
    if (this.assessmentSaved) return;
    if (this.draftTimer) clearTimeout(this.draftTimer);
    this.draftTimer = setTimeout(() => void this.persistDraft(), 900);
  }

  private async restoreDraft(): Promise<void> {
    if (!this.patientId) return;
    const revision = this.formRevision;
    this.restoringDraft = true;
    try {
      const saved = await this.drafts.load<any>(this.draftKey());
      // A slow draft response must not undo a clinician's change or clear action.
      if (!saved?.payload?.form || revision !== this.formRevision || this.assessmentSaved) return;
      this.form.patchValue(saved.payload.form, { emitEvent: false });
      if (saved.payload.coding) this.coding = saved.payload.coding;
      this.normalizeStage();
      this.draftStatus = saved.updatedAt
        ? `Draft restored from ${new Date(saved.updatedAt).toLocaleString()}`
        : 'Draft restored';
    } catch {
      // Draft recovery is additive and must never block wound documentation.
    } finally {
      this.restoringDraft = false;
      if (revision !== this.formRevision) this.scheduleDraft();
    }
  }

  private async persistDraft(): Promise<void> {
    if (!this.patientId || this.loading || this.restoringDraft || this.assessmentSaved) return;
    this.normalizeStage();
    const form = this.form.getRawValue();
    const key = this.draftKey();
    // Serialize snapshots so an older request cannot overwrite a cleared stage.
    const saving = this.pendingDraftSave.catch(() => undefined)
      .then(() => this.drafts.save(key, { form, coding: this.coding }));
    this.pendingDraftSave = saving;
    try {
      await saving;
      this.draftStatus = 'Draft autosaved.';
    } catch {
      this.draftStatus = 'Draft not synced yet.';
    }
  }

  async takePhoto() {
    try {
      const flashHint = await this.toastCtrl.create({
        message: 'Use the phone camera flash/auto-flash control when lighting is poor. Keep the lens perpendicular to the wound when possible.',
        duration: 3200,
        icon: 'flash',
      });
      await flashHint.present();

      const image = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        direction: CameraDirection.Rear,
        quality: 92,
        allowEditing: false,
        correctOrientation: true,
        saveToGallery: false,
      });

      if (image?.dataUrl) {
        this.photoDataUrl = image.dataUrl;
        this.photoPreview = image.dataUrl;
      }
    } catch (err) {
      console.error('Camera error', err);
      const toast = await this.toastCtrl.create({
        message: 'Camera canceled or not available',
        duration: 2000,
      });
      await toast.present();
    }
  }

  async pickFromGallery() {
    try {
      const image = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
        quality: 80,
      });

      if (image?.dataUrl) {
        this.photoDataUrl = image.dataUrl;
        this.photoPreview = image.dataUrl;
      }
    } catch (err) {
      console.error('Gallery error', err);
    }
  }

  private async uploadPhotoIfNeeded(assessmentId: string, uploadedBy: string): Promise<string | undefined> {
    if (!this.photoDataUrl) return undefined;
    return this.assessments.uploadWoundPhoto(this.patientId, assessmentId, this.photoDataUrl, uploadedBy);
  }

  async save() {
    if (this.loading || this.assessmentSaved) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.codingErrors = this.codingSection?.blockingIssues() ?? [];
    if (this.codingErrors.length) return;

    const savedDraftKey = this.draftKey();
    this.loading = true;

    const savingToast = await this.toastCtrl.create({
      message: 'Saving assessment...',
      duration: 0,
    });
    await savingToast.present();

    try {
      const firebaseUser = getAuth().currentUser;
      const uid = firebaseUser?.uid || null;
      const displayName = firebaseUser?.displayName || 'Nurse';

      if (!uid) {
        throw new Error('No logged user uid (user not authenticated)');
      }

      const now = new Date();
      const v = this.form.getRawValue();
      const isNewAssessment = !this.assessmentId;

      // The web app's WoundAssessment shape, filled from what was actually
      // asked. Nothing is invented for a question the form did not put.
      let basePayload: any = {
        patientId: this.patientId,

        createdAt: now,
        assessedAt: now,
        updatedAt: now,

        createdBy: uid,          // for the rules (canCreateSub)
        createdByUid: uid,       // for the web app
        createdByName: displayName || 'Nurse',

        describe: {
          type: v.describe.type || 'Other',
          stage: stageForWoundType(v.describe.type, v.describe.stage) || null,
          location: v.describe.location || '',
          anatomy: v.describe.anatomy || null,
          acquired: v.describe.acquired || 'In-House Acquired',
          ageCategory: '',
          exactDate: null,
          stagedBy: 'In-house nursing',
          notes: v.describe.notes || '',
        },

        measurements: {
          length: v.measurements.length,
          width: v.measurements.width,
          depth: v.measurements.depth,
          area: this.area,
          volume: this.volume,
          undermining: v.measurements.undermining || '',
          tunneling: v.measurements.tunneling || '',
        },

        woundBed: {
          epithelial: v.woundBed.epithelial,
          granulation: {
            present: v.woundBed.granulationPresent,
            percent: v.woundBed.granulationPercent,
          },
          slough: {
            present: v.woundBed.sloughPresent,
            percent: v.woundBed.sloughPercent,
          },
          eschar: v.woundBed.eschar,
          infection: v.woundBed.infection || [],
          other: v.woundBed.other || [],
          otherNote: v.woundBed.otherNote || '',
        },

        exudate: {
          amount: v.exudate.amount,
          type: v.exudate.type,
          odor: v.exudate.odor,
        },

        periwound: {
          edges: v.periwound.edges,
          surrounding: v.periwound.surrounding || [],
          induration: v.periwound.induration,
          edema: v.periwound.edema,
          temperature: v.periwound.temperature,
        },

        pain: {
          cognitivelyImpaired: v.pain.cognitivelyImpaired,
          score: v.pain.score,
          frequency: v.pain.frequency,
          notes: v.pain.notes || '',
        },

        progress: {
          status: v.progress.status || 'New',
          infection: v.progress.infection,
          notes: v.progress.notes || '',
          education: '',
        },

        photoURL: null,
      };

      // Only what was chosen. An empty section is left off the document
      // entirely rather than stored as a row of blanks, so a reader can tell
      // "no dressing recorded" from "no dressing applied".
      const treatment = buildWoundTreatment(v.treatment);
      const procedure = assessmentDebridementPayload(v.debridementProcedure);
      if (procedure) basePayload.debridementProcedure = procedure;
      if (treatment) basePayload.treatment = treatment;
      if (v.orders.goalOfCare) basePayload.orders = { goalOfCare: v.orders.goalOfCare };

      let id = this.assessmentId;

      if (!id) {
        // The id is allocated first so the single create write already
        // carries the wound identity. A re-evaluation inherits its parent's
        // woundId from the route; a new wound IS its own first assessment,
        // so it points at itself.
        id = this.assessments.newId(this.patientId);
        basePayload.woundId = woundIdForCreate(this.woundId, id);
        const coding = this.codingForSave(basePayload.woundId);
        if (coding) basePayload.clinicalCoding = coding;
        const linkResult = await this.assessments.createWithId(this.patientId, id, basePayload, {
          appointmentId: this.appointmentId,
          fieldEncounterVisitId: this.fieldEncounterVisitId,
          newWound: !this.woundId,
        });
        // The service resolves the canonical wound/episode/visit linkage in
        // the same batch as the assessment. Keep that exact identity in this
        // page so downstream Care Plan / Education / Orders / Progress Note
        // do not fall back to a wound-neutral physical encounter.
        this.woundId = linkResult.woundId;
        this.appointmentId = linkResult.appointmentId || this.appointmentId;
        this.fieldEncounterVisitId = linkResult.fieldEncounterVisitId || this.fieldEncounterVisitId;
        basePayload.woundId = linkResult.woundId;
        basePayload.episodeId = linkResult.episodeId;
      } else {
        basePayload.updatedAt = now;
        // Never on an update. The stored value is the wound's identity and
        // nothing on this screen is entitled to change it -- writing the
        // wrong one here would move an assessment to another wound's
        // timeline, or split a wound in two, from an edit about a dressing.
        basePayload = stripWoundIdForUpdate(basePayload);
        // An edit that clears the treatment section has to erase what was
        // there. Leaving the key off an update() is a no-op in Firestore, so
        // the old dressing would survive its own deletion.
        if (!treatment) basePayload.treatment = null;
        if (!v.orders.goalOfCare) basePayload.orders = null;
        // Cleared coding is erased the same way, never left behind.
        basePayload.clinicalCoding = this.codingForSave(this.woundId || id);
        delete basePayload.createdAt;
        delete basePayload.createdBy;
        delete basePayload.createdByUid;
        delete basePayload.createdByName;
        delete basePayload.photoURL;

        await this.assessments.update(this.patientId, id, basePayload);
      }

      const url = await this.uploadPhotoIfNeeded(id!, uid);
      if (url) {
        await this.assessments.update(this.patientId, id!, {
          photoURL: url,
          updatedAt: new Date(),
        });
      }

      // A round assessment must become visible in the round immediately.
      // The assessment remains the source record in patients/{id}/assessments;
      // woundRounds only stores the immutable ids needed by the round queue.
      let roundLinkFailed = false;
      if (this.roundId && isNewAssessment) {
        const linkedWoundId = basePayload.woundId || this.woundId || id!;
        try {
          await this.rounds.linkAssessment(this.roundId, this.patientId, id!, linkedWoundId);
        } catch (linkError) {
          roundLinkFailed = true;
          console.error('[AssessmentForm] Assessment saved but wound-round linking failed', linkError);
        }
      }

      this.assessmentSaved = true;
      this.loading = false;
      await savingToast.dismiss();

      // Creation changes wound/visit IDs. Delete the original NEW draft, not a
      // newly derived reevaluation key, and never recreate it on destruction.
      if (this.draftTimer) clearTimeout(this.draftTimer);
      await this.pendingDraftSave.catch(() => undefined);
      const draftCleared = await this.drafts.clear(savedDraftKey).then(() => true, () => false);
      this.draftStatus = '';

      const doneToast = await this.toastCtrl.create({
        message: (this.roundId
          ? (roundLinkFailed
              ? 'Assessment saved. Round linkage will be reconciled when evaluation is completed.'
              : 'Assessment saved and linked to wound round')
          : 'Assessment saved') + (draftCleared ? '' : ' Draft cleanup failed; an older draft may still appear. Do not save it as a new wound.'),
        duration: !draftCleared ? 7000 : roundLinkFailed ? 3500 : 2000,
        color: roundLinkFailed || !draftCleared ? 'warning' : undefined,
      });
      await doneToast.present();

      if (this.roundId) {
        await this.router.navigate(['/tabs', 'wound-rounds', this.roundId], {
          queryParams: { patientId: this.patientId },
        });
      } else {
        await this.router.navigate(['/tabs', 'skin-wound', this.patientId, 'assessments'], {
          queryParams: clinicalVisitQueryParams({
            visitId: this.fieldEncounterVisitId || null,
            appointmentId: this.appointmentId || null,
            woundId: basePayload.woundId || this.woundId || id || null,
            episodeId: basePayload.episodeId || null,
            fieldEncounterVisitId: this.fieldEncounterVisitId || null,
          }),
        });
      }
    } catch (err) {
      console.error(err);
      this.loading = false;
      await savingToast.dismiss();

      // Keep the form intact and show a safe, actionable failure category.
      // Do not render raw Firebase messages: they can contain resource paths.
      const code = typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: unknown }).code || '')
        : '';
      const message = err instanceof Error ? err.message : '';
      const failure = code === 'permission-denied' || code === 'storage/unauthorized'
        ? 'Permission denied. Assessment not confirmed saved.'
        : code === 'unavailable' || code === 'deadline-exceeded'
          ? 'Connection unavailable. Assessment not confirmed saved.'
          : message.startsWith('The active field encounter is missing.')
            ? 'Scheduled visit missing. Return to the visit before saving.'
            : 'Could not confirm assessment save. Keep this form open and contact support.';
      console.error('[AssessmentForm] Save failed', { code, hasFieldEncounter: !!this.fieldEncounterVisitId, isNew: !this.assessmentId });
      const toast = await this.toastCtrl.create({
        message: failure,
        duration: 5500,
        color: 'danger',
      });
      await toast.present();
    }
  }
}
