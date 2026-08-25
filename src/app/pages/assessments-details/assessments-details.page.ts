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
  createOutline,
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
      createOutline,
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
  ]);
}

}
