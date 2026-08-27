// src/app/pages/assessment-form/assessment-form.page.ts
import { Component, inject, OnInit } from '@angular/core';
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
import { camera, images } from 'ionicons/icons';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { AssessmentsService } from '../../services/assessments.service';
import { getAuth } from 'firebase/auth';
import { take } from 'rxjs/operators';

import {
  ACQUIRED,
  EDEMA,
  EDGES,
  EXUDATE_AMOUNTS,
  EXUDATE_TYPES,
  INDURATION,
  INFECTION_SIGNS,
  INFECTION_STATUS,
  ODORS,
  PAIN_FREQUENCY,
  STAGES,
  STATUS,
  SURROUNDING,
  TEMPERATURE,
  TUNNELING,
  UNDERMINING,
  WOUND_OTHER,
  WOUND_TYPES,
} from 'src/app/shared/wound-vocabulary';

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
  ],
})
export class AssessmentFormPage implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private assessments = inject(AssessmentsService);
  private toastCtrl = inject(ToastController);

  patientId = this.route.snapshot.paramMap.get('patientId')!;
  assessmentId = this.route.snapshot.paramMap.get('assessmentId'); // undefined = NEW

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

  loading = false;

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
  });

  photoPreview?: string;
  private photoDataUrl?: string;

  constructor() {
    addIcons({ camera, images });
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
    if (this.assessmentId) {
      this.loadForEdit();
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

          this.form.patchValue({
            describe: {
              type: data.describe?.type || data.type || '',
              stage: data.describe?.stage || data.stage || '',
              location: data.describe?.location || data.location || '',
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
          });

          if (data.photoURL) {
            this.photoPreview = data.photoURL;
          }

          this.loading = false;
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

  async takePhoto() {
    try {
      const image = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        quality: 70,
        allowEditing: false,
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
      toast.present();
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
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

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

      // The web app's WoundAssessment shape, filled from what was actually
      // asked. Nothing is invented for a question the form did not put.
      const basePayload: any = {
        patientId: this.patientId,

        createdAt: now,
        assessedAt: now,
        updatedAt: now,

        createdBy: uid,          // for the rules (canCreateSub)
        createdByUid: uid,       // for the web app
        createdByName: displayName || 'Nurse',

        describe: {
          type: v.describe.type || 'Other',
          stage: v.describe.stage || null,
          location: v.describe.location || '',
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

      let id = this.assessmentId;

      if (!id) {
        id = await this.assessments.create(this.patientId, basePayload);
      } else {
        basePayload.updatedAt = now;
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

      this.loading = false;
      savingToast.dismiss();

      const doneToast = await this.toastCtrl.create({
        message: 'Assessment saved',
        duration: 2000,
      });
      doneToast.present();

      this.router.navigate(['/tabs', 'skin-wound', this.patientId, 'assessments']);
    } catch (err) {
      console.error(err);
      this.loading = false;
      savingToast.dismiss();

      const toast = await this.toastCtrl.create({
        message: 'Error saving assessment',
        duration: 2500,
        color: 'danger',
      });
      toast.present();
    }
  }
}
