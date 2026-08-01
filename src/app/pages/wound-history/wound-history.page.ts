// src/app/pages/wound-history/wound-history.page.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { AssessmentsService, MobileAssessment } from 'src/app/services/assessments.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-wound-history',
  standalone: true,
  templateUrl: './wound-history.page.html',
  styleUrls: ['./wound-history.page.scss'],
  imports: [IonicModule, CommonModule, RouterModule],
})
export class WoundHistoryPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private assessments = inject(AssessmentsService);

  patientId = this.route.snapshot.paramMap.get('patientId')!;
  woundId   = this.route.snapshot.paramMap.get('woundId')!;

  items$!: Observable<MobileAssessment[]>;
  loading = true;

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
