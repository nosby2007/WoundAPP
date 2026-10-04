import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCheckbox,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';

import {
  CARE_PLAN_PROBLEM_CATEGORIES,
  CarePlanCatalogEntry,
  CarePlanProblemCategory,
  splitLines,
  todayIsoDate,
} from '../../shared/care-plan';
import { CarePlanService } from '../../services/care-plan.service';
import { AssessmentsService } from '../../services/assessments.service';
import { take } from 'rxjs/operators';

/**
 * A care plan for one wound, written on the way out of the visit.
 *
 * The plan for a wound is decided while looking at it. Deferring it to a desk
 * means it is written from the assessment note instead of from the wound, and
 * usually a day later.
 *
 * Organization templates provide a reusable problem + goal bundle, while the
 * catalog provides atomic goals and interventions for the same category.
 * Both are admin-authored; free text is stored separately so it cannot pass
 * for governed content. No clinical goal text ships in this app.
 */
@Component({
  selector: 'app-wound-care-plan',
  standalone: true,
  templateUrl: './wound-care-plan.page.html',
  styleUrls: ['./wound-care-plan.page.scss'],
  imports: [
    CommonModule, ReactiveFormsModule,
    IonBackButton, IonButton, IonButtons, IonCheckbox, IonContent, IonHeader,
    IonInput, IonItem, IonLabel, IonList, IonNote, IonSelect, IonSelectOption,
    IonSpinner, IonTextarea, IonTitle, IonToolbar,
  ],
})
export class WoundCarePlanPage implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private carePlans = inject(CarePlanService);
  private assessments = inject(AssessmentsService);
  private toastCtrl = inject(ToastController);

  patientId = this.route.snapshot.paramMap.get('patientId')!;
  assessmentId = this.route.snapshot.paramMap.get('assessmentId')!;
  appointmentId = this.route.snapshot.queryParamMap.get('appointmentId') || '';
  woundVisitId = this.route.snapshot.queryParamMap.get('woundVisitId') || '';
  episodeId = this.route.snapshot.queryParamMap.get('episodeId') || '';
  fieldEncounterVisitId =
    this.route.snapshot.queryParamMap.get('fieldEncounterVisitId') ||
    this.appointmentId ||
    this.woundVisitId ||
    '';

  categories = CARE_PLAN_PROBLEM_CATEGORIES;

  /** The wound this plan is for, shown so the nurse can see what they picked. */
  woundLabel = '';
  woundId: string | null = null;

  private _catalog: CarePlanCatalogEntry[] = [];
  get catalog(): CarePlanCatalogEntry[] { return this._catalog; }
  set catalog(value: CarePlanCatalogEntry[]) {
    this._catalog = value || [];
    this.templateOptions = this.buildTemplateOptions(this._catalog);
  }
  /** Template options are shared with Ionic's popover. Keep stable references
   * across change-detection passes, especially on Mobile Safari. */
  templateOptions: CatalogTemplateProblemOption[] = [];
  catalogLoaded = false;
  selectedGoalIds = new Set<string>();
  selectedInterventionIds = new Set<string>();
  selectedTemplateProblem: CatalogTemplateProblemOption | null = null;

  saving = false;
  errorMsg = '';

  form = this.fb.group({
    title: ['', Validators.required],
    category: ['' as CarePlanProblemCategory | '', Validators.required],
    startDate: [todayIsoDate(), Validators.required],
    description: [''],
    customGoals: [''],
    customInterventions: [''],
  });

  ngOnInit(): void {
    void this.loadCatalog();
    this.loadWound();
  }

  /** Catalog goals for the chosen category, which is how the web filters them. */
  get goalOptions(): CarePlanCatalogEntry[] {
    const category = this.form.value.category;
    if (!category) return [];
    return this.catalog.filter((item) => item.kind === 'goal' && item.category === category);
  }

  get interventionOptions(): CarePlanCatalogEntry[] {
    const category = this.form.value.category;
    if (!category) return [];
    return this.catalog.filter((item) => item.kind === 'intervention' && item.category === category);
  }

  get templateProblemOptions(): CatalogTemplateProblemOption[] {
    return this.templateOptions;
  }

  toggleGoal(id: string, checked: boolean): void {
    if (checked) this.selectedGoalIds.add(id);
    else this.selectedGoalIds.delete(id);
  }

  isGoalSelected(id: string): boolean {
    return this.selectedGoalIds.has(id);
  }

  toggleIntervention(id: string, checked: boolean): void {
    if (checked) this.selectedInterventionIds.add(id);
    else this.selectedInterventionIds.delete(id);
  }

  isInterventionSelected(id: string): boolean {
    return this.selectedInterventionIds.has(id);
  }

  applyTemplateProblem(key: string): void {
    const option = this.templateProblemOptions.find((item) => item.key === key);
    this.selectedTemplateProblem = option || null;
    this.selectedGoalIds.clear();
    this.selectedInterventionIds.clear();
    if (!option) return;
    this.form.patchValue({
      title: option.problemLabel,
      category: option.category,
    });
  }

  onCategoryChanged(category: CarePlanProblemCategory | ''): void {
    // Catalog selections are category-specific. Keeping hidden selections
    // after the clinician changes category would file the wrong governed
    // text under the new problem.
    this.selectedGoalIds.clear();
    this.selectedInterventionIds.clear();
    if (this.selectedTemplateProblem && this.selectedTemplateProblem.category !== category) {
      this.selectedTemplateProblem = null;
    }
  }

  private async loadCatalog(): Promise<void> {
    try {
      this.catalog = await this.carePlans.listCatalog();
    } catch (err) {
      console.warn('[WoundCarePlanPage] catalog unavailable', err);
      this.catalog = [];
    } finally {
      this.catalogLoaded = true;
    }
  }

  private buildTemplateOptions(catalog: CarePlanCatalogEntry[]): CatalogTemplateProblemOption[] {
    const grouped = new Map<string, CatalogTemplateProblemOption>();
    for (const goal of catalog) {
      if (goal.kind !== 'goal' || !goal.sourceTemplateId || !goal.sourceTemplateProblemId) continue;
      const key = `${goal.sourceTemplateId}::${goal.sourceTemplateProblemId}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.goals.push(goal);
        continue;
      }
      grouped.set(key, {
        key,
        templateId: goal.sourceTemplateId,
        templateName: goal.sourceTemplateName || 'Organization template',
        problemId: goal.sourceTemplateProblemId,
        problemLabel: goal.sourceTemplateProblemLabel || goal.category,
        category: goal.category as CarePlanProblemCategory,
        goals: [goal],
      });
    }
    return Array.from(grouped.values()).sort((a, b) =>
      a.templateName.localeCompare(b.templateName) || a.problemLabel.localeCompare(b.problemLabel)
    );
  }

  private loadWound(): void {
    this.assessments.getRaw(this.patientId, this.assessmentId).pipe(take(1)).subscribe({
      next: (data) => {
        if (!data) return;
        // The wound's stable identity, with the same fallback the assessment
        // list uses: older documents predate woundId and are their own wound.
        this.woundId = data.woundId || this.assessmentId;
        const type = data.describe?.type || data.type || 'Wound';
        const location = data.describe?.location || data.location || '';
        this.woundLabel = location ? `${type} — ${location}` : type;

        if (!this.form.value.title && this.woundLabel) {
          this.form.patchValue({ title: this.woundLabel });
        }
      },
      error: (err) => console.warn('[WoundCarePlanPage] wound unavailable', err),
    });
  }

  async save(): Promise<void> {
    if (this.form.invalid || this.saving) return;

    const customGoals = splitLines(this.form.value.customGoals);
    const customInterventions = splitLines(this.form.value.customInterventions);
    const goalCatalogRefs = Array.from(this.selectedGoalIds);
    const interventionCatalogRefs = Array.from(this.selectedInterventionIds);
    const templateGoals = (this.selectedTemplateProblem?.goals || []).map((goal) => ({
      id: goal.sourceTemplateGoalId || goal.id,
      text: goal.text,
    }));

    if (!templateGoals.length && !goalCatalogRefs.length && !customGoals.length) {
      // A plan with no goal is a title. Saying so is more use than saving it.
      this.errorMsg = 'Pick at least one goal, or write one.';
      return;
    }

    this.saving = true;
    this.errorMsg = '';

    try {
      await this.carePlans.create(this.patientId, {
        title: this.form.value.title!,
        description: this.form.value.description || null,
        startDate: this.form.value.startDate!,
        woundId: this.woundId,
        category: this.form.value.category as CarePlanProblemCategory,
        goalCatalogRefs,
        interventionCatalogRefs,
        customGoals,
        customInterventions,
        sourceTemplateId: this.selectedTemplateProblem?.templateId || null,
        sourceTemplateProblemId: this.selectedTemplateProblem?.problemId || null,
        problemLabel: this.selectedTemplateProblem?.problemLabel || null,
        templateGoals,
      }, {
        visitId: this.woundVisitId || this.appointmentId || null,
        appointmentId: this.appointmentId || null,
        woundId: this.woundId,
        episodeId: this.episodeId || null,
        fieldEncounterVisitId: this.fieldEncounterVisitId || null,
      });

      const toast = await this.toastCtrl.create({ message: 'Care plan saved', duration: 2000 });
      await toast.present();
      this.router.navigate(
        ['/tabs', 'skin-wound', this.patientId, 'assessments', this.assessmentId],
        {
          queryParams: {
            ...(this.appointmentId ? { appointmentId: this.appointmentId } : {}),
            ...((this.woundVisitId || this.appointmentId) ? { woundVisitId: this.woundVisitId || this.appointmentId } : {}),
            ...(this.episodeId ? { episodeId: this.episodeId } : {}),
            ...(this.fieldEncounterVisitId ? { fieldEncounterVisitId: this.fieldEncounterVisitId } : {}),
            ...(this.woundId ? { woundId: this.woundId } : {}),
          },
        }
      );
    } catch (err: any) {
      console.error('[WoundCarePlanPage] save failed', err);
      this.errorMsg = err?.message || 'Could not save the care plan.';
    } finally {
      this.saving = false;
    }
  }
}

interface CatalogTemplateProblemOption {
  key: string;
  templateId: string;
  templateName: string;
  problemId: string;
  problemLabel: string;
  category: CarePlanProblemCategory;
  goals: CarePlanCatalogEntry[];
}
