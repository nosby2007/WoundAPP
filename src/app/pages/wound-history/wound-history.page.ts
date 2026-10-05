// src/app/pages/wound-history/wound-history.page.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { AssessmentsService, MobileAssessment } from 'src/app/services/assessments.service';
import { Observable } from 'rxjs';
import { addIcons } from 'ionicons';
import { addOutline, documentTextOutline } from 'ionicons/icons';

@Component({
  selector: 'app-wound-history',
  standalone: true,
  templateUrl: './wound-history.page.html',
  styleUrls: ['./wound-history.page.scss'],
  imports: [ CommonModule, RouterModule,
    // Ionic standalone resolves ion-* through these component classes.
    // IonicModule (the NgModule API) sat here instead, which registers
    // nothing for a standalone component: the tags fell through as
    // unknown elements and the page rendered as bare HTML.
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonRefresher,
    IonRefresherContent,
    IonSpinner,
    IonTitle,
    IonToolbar,
  ],
})
export class WoundHistoryPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private assessments = inject(AssessmentsService);

  patientId = this.route.snapshot.paramMap.get('patientId')!;
  woundId   = this.route.snapshot.paramMap.get('woundId')!;

  items$!: Observable<MobileAssessment[]>;
  loading = true;

  constructor() {
    // Ionic standalone has no global icon registry: each page registers the
    // glyphs its own template names.
    addIcons({ addOutline, documentTextOutline });
  }

  ngOnInit() {
    this.items$ = this.assessments.listForWound(this.patientId, this.woundId);
    this.loading = false;
  }

  openAssessment(a: MobileAssessment) {
    this.router.navigate([
      '/tabs',
      'skin-wound',
      this.patientId,
      'assessments',
      a.id,
    ]);
  }

  newAssessmentForThisWound() {
    this.router.navigate([
      '/tabs',
      'skin-wound',
      this.patientId,
      'assessments',
      'new'
    ], {
      queryParams: { woundId: this.woundId },   // ✅ on passe la plaie
    });
  }

   backToList() {
    this.router.navigate([
      '/tabs',
      'skin-wound',
      this.patientId,
      'assessments',
    ]);
  }
}
