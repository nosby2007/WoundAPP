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
 * The goals are the organization's own, read from
 * organizations/{orgId}/carePlanCatalog. This screen offers the ones an admin
 * authored for the chosen problem category, plus a free-text box for anything
 * not in the catalog yet -- stored as `customGoals`, so it is visibly custom
 * rather than passing for curated content. No clinical goal text ships in
 * this app.
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

  categories = CARE_PLAN_PROBLEM_CATEGORIES;

  /** The wound this plan is for, shown so the nurse can see what they picked. */
  woundLabel = '';
  woundId: string | null = null;

  catalog: CarePlanCatalogEntry[] = [];
  catalogLoaded = false;
  selectedGoalIds = new Set<string>();

  saving = false;
  errorMsg = '';

  form = this.fb.group({
    title: ['', Validators.required],
    category: ['' as CarePlanProblemCategory | '', Validators.required],
    startDate: [todayIsoDate(), Validators.required],
    description: [''],
    customGoals: [''],
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

  toggleGoal(id: string, checked: boolean): void {
    if (checked) this.selectedGoalIds.add(id);
    else this.selectedGoalIds.delete(id);
  }

  isGoalSelected(id: string): boolean {
    return this.selectedGoalIds.has(id);
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
    const goalCatalogRefs = Array.from(this.selectedGoalIds);

    if (!goalCatalogRefs.length && !customGoals.length) {
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
        customGoals,
      });

      const toast = await this.toastCtrl.create({ message: 'Care plan saved', duration: 2000 });
      await toast.present();
      this.router.navigate(['/tabs', 'skin-wound', this.patientId, 'assessments', this.assessmentId]);
    } catch (err: any) {
      console.error('[WoundCarePlanPage] save failed', err);
      this.errorMsg = err?.message || 'Could not save the care plan.';
    } finally {
      this.saving = false;
    }
  }
}
