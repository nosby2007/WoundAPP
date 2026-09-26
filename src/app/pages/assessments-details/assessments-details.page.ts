// src/app/pages/assessment-detail/assessment-detail.page.ts
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonCol,
  IonContent,
  IonFooter,
  IonGrid,
  IonHeader,
  IonIcon,
  IonRow,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import {
  arrowBack,
  clipboardOutline,
  createOutline,
  documentTextOutline,
  schoolOutline,
} from 'ionicons/icons';
import { AssessmentsService } from '../../services/assessments.service';
import { Subscription } from 'rxjs';

@Component({
   selector: 'app-assessments-details',
  templateUrl: './assessments-details.page.html',
  styleUrls: ['./assessments-details.page.scss'],
  imports: [ CommonModule, RouterModule,
    // Ionic standalone resolves ion-* through these component classes.
    // IonicModule (the NgModule API) sat here instead, which registers
    // nothing for a standalone component: the tags fell through as
    // unknown elements and the page rendered as bare HTML.
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardSubtitle,
    IonCardTitle,
    IonCol,
    IonContent,
    IonFooter,
    IonGrid,
    IonHeader,
    IonIcon,
    IonRow,
    IonSpinner,
    IonTitle,
    IonToolbar,
  ],
})
export class AssessmentDetailPage implements OnInit, OnDestroy {

  constructor() {
    // Ionic standalone has no global icon registry: each page
    // registers the glyphs its own template names.
    addIcons({
      arrowBack,
      clipboardOutline,
      createOutline,
      documentTextOutline,
      schoolOutline,
    });
  }
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private assessmentsService = inject(AssessmentsService);

  patientId!: string;
  assessmentId!: string;

  loading = true;
  errorMsg = '';
  assessment: any | null = null;

  private sub?: Subscription;

  /**
   * The wound's stable identity. Assessments created before `woundId`
   * existed are their own wound, which is the same fallback the assessment
   * list uses -- without it, a care plan or a note written against an older
   * assessment would carry no wound at all.
   */
  get woundId(): string {
    return this.assessment?.woundId || this.assessmentId;
  }

  /** "Pressure — Right heel", for the note that gets written next to it. */
  get woundLabel(): string {
    const type = this.assessment?.describe?.type || this.assessment?.type || 'Wound';
    const location = this.assessment?.describe?.location || this.assessment?.location || '';
    return location ? `${type} — ${location}` : type;
  }

  ngOnInit() {
    this.sub = this.route.paramMap.subscribe(params => {
      this.patientId = params.get('patientId') || '';
      this.assessmentId = params.get('assessmentId') || '';

      if (!this.patientId || !this.assessmentId) {
        this.errorMsg = 'Missing patient or assessment id.';
        this.loading = false;
        return;
      }

      this.load();
    });
  }

  private load() {
    this.loading = true;
    this.errorMsg = '';

    this.assessmentsService
      .getRaw(this.patientId, this.assessmentId)
      .subscribe({
        next: a => {
          this.assessment = a;
          if (!a) {
            this.errorMsg = 'Assessment not found.';
          }
          this.loading = false;
        },
        error: err => {
          console.error('[AssessmentDetail] error', err);
          this.errorMsg = 'Error loading assessment.';
          this.loading = false;
        },
      });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  backToList() {
    this.router.navigate([
      '/tabs',
      'skin-wound',
      this.patientId,
      'assessments',
    ]);
  }
  // src/app/pages/assessment-detail/assessment-detail.page.ts
editAssessment() {
  if (!this.patientId || !this.assessmentId) return;

  this.router.navigate([
    '/tabs',
    'skin-wound',
    this.patientId,
    'assessments',
    this.assessmentId,
    'edit',
  ], { queryParams: this.visitQueryParams() });
}

  private visitQueryParams(): Record<string, string> {
    const current = this.route.snapshot.queryParamMap;
    const visitId = String(
      this.assessment?.visitId ||
      this.assessment?.woundVisitId ||
      current.get('woundVisitId') ||
      current.get('appointmentId') ||
      ''
    ).trim();
    const appointmentId = String(
      this.assessment?.appointmentId ||
      current.get('appointmentId') ||
      ''
    ).trim();
    const episodeId = String(
      this.assessment?.episodeId ||
      current.get('episodeId') ||
      ''
    ).trim();
    const fieldEncounterVisitId = String(
      this.assessment?.fieldEncounterVisitId ||
      current.get('fieldEncounterVisitId') ||
      appointmentId ||
      visitId ||
      ''
    ).trim();

    const params: Record<string, string> = {
      woundId: this.woundId,
      woundLabel: this.woundLabel,
      assessmentId: this.assessmentId,
    };
    if (appointmentId) params['appointmentId'] = appointmentId;
    if (visitId) params['woundVisitId'] = visitId;
    if (episodeId) params['episodeId'] = episodeId;
    if (fieldEncounterVisitId) params['fieldEncounterVisitId'] = fieldEncounterVisitId;
    return params;
  }

  /** The plan for this wound, decided while looking at it. */
  openCarePlan() {
    if (!this.patientId || !this.assessmentId) return;
    this.router.navigate([
      '/tabs', 'skin-wound', this.patientId, 'assessments', this.assessmentId, 'care-plan',
    ], { queryParams: this.visitQueryParams() });
  }

  /**
   * A progress note about this wound. The same note page the tab opens --
   * one collection, one shape, one set of failure messages -- carrying the
   * wound as query parameters so the chart records which one it was about.
   */
  /** What the patient or caregiver was taught about this wound. */
  openEducation() {
    if (!this.patientId || !this.assessmentId) return;
    this.router.navigate(['/tabs', 'skin-wound', this.patientId, 'education'], {
      queryParams: this.visitQueryParams(),
    });
  }

  openNote() {
    if (!this.patientId || !this.assessmentId) return;
    this.router.navigate(['/tabs', 'progress-note', this.patientId], {
      queryParams: this.visitQueryParams(),
    });
  }

}
