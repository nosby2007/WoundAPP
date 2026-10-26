import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonSpinner, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { addOutline, analyticsOutline, locateOutline } from 'ionicons/icons';
import { AssessmentsService, MobileAssessment } from '../../services/assessments.service';
import { WoundAnatomyPosition, WoundMapMarker } from '../../shared/wound-anatomy';
import { WoundBodyMapComponent } from '../../shared/wound-body-map.component';
import { groupAssessmentsByWound, resolveWoundId } from '../../shared/wound-identity';
import { percentChange, trendPolyline, woundTrend } from '../../shared/wound-trend';

@Component({
  selector: 'app-wound-overview',
  standalone: true,
  imports: [CommonModule, IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonSpinner, IonTitle, IonToolbar, WoundBodyMapComponent],
  templateUrl: './wound-overview.page.html',
  styleUrls: ['./wound-overview.page.scss'],
})
export class WoundOverviewPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly assessmentsService = inject(AssessmentsService);

  readonly addOutline = addOutline;
  readonly analyticsOutline = analyticsOutline;
  readonly locateOutline = locateOutline;
  readonly resolveWoundId = resolveWoundId;
  readonly patientId = this.route.snapshot.paramMap.get('patientId') || '';
  readonly loading = signal(true);
  readonly error = signal('');
  readonly patientName = signal('Patient');
  readonly assessments = signal<MobileAssessment[]>([]);
  readonly selectedWoundId = signal('');

  readonly woundGroups = computed(() => groupAssessmentsByWound(this.assessments()));
  readonly latestWounds = computed(() => this.woundGroups().map(group => group.latest));
  readonly markers = computed<WoundMapMarker[]>(() => this.latestWounds()
    .filter(item => !!item.anatomy && !!resolveWoundId(item))
    .map((item, index) => ({
      ...(item.anatomy as WoundAnatomyPosition),
      woundId: resolveWoundId(item) as string,
      woundLabel: item.location || `Wound ${index + 1}`,
      status: item.status || null,
      index: index + 1,
    })));
  readonly unlocatedCount = computed(() => this.latestWounds().filter(item => !item.anatomy).length);
  readonly selectedWound = computed(() => this.latestWounds().find(item => resolveWoundId(item) === this.selectedWoundId()) || this.latestWounds()[0] || null);
  readonly selectedHistory = computed(() => {
    const woundId = resolveWoundId(this.selectedWound());
    return woundId ? this.assessments().filter(item => resolveWoundId(item) === woundId) : [];
  });
  readonly areaTrend = computed(() => woundTrend(this.selectedHistory(), 'area'));
  readonly lengthTrend = computed(() => woundTrend(this.selectedHistory(), 'length'));
  readonly widthTrend = computed(() => woundTrend(this.selectedHistory(), 'width'));
  readonly depthTrend = computed(() => woundTrend(this.selectedHistory(), 'depth'));
  readonly areaPolyline = computed(() => trendPolyline(this.areaTrend()));
  readonly dimensionMax = computed(() => Math.max(1, ...[
    ...this.lengthTrend(), ...this.widthTrend(), ...this.depthTrend(),
  ].map(point => point.value)));
  readonly lengthPolyline = computed(() => trendPolyline(this.lengthTrend(), 100, 46, 5, { min: 0, max: this.dimensionMax() }));
  readonly widthPolyline = computed(() => trendPolyline(this.widthTrend(), 100, 46, 5, { min: 0, max: this.dimensionMax() }));
  readonly depthPolyline = computed(() => trendPolyline(this.depthTrend(), 100, 46, 5, { min: 0, max: this.dimensionMax() }));
  readonly areaChange = computed(() => percentChange(this.areaTrend()));

  constructor() {
    this.assessmentsService.getPatient(this.patientId).subscribe(patient => {
      if (patient) this.patientName.set(patient.name);
    });
    this.assessmentsService.listForPatient(this.patientId).subscribe({
      next: list => {
        this.assessments.set(list);
        if (!this.selectedWoundId() && list.length) this.selectedWoundId.set(resolveWoundId(list[0]) || '');
        this.loading.set(false);
      },
      error: () => { this.error.set('Unable to load the wound overview.'); this.loading.set(false); },
    });
  }

  selectWound(woundId: string): void { this.selectedWoundId.set(woundId); }
  selectMarker(marker: WoundMapMarker): void { this.selectWound(marker.woundId); }
  newAssessment(): void { void this.router.navigate(['/tabs/skin-wound', this.patientId, 'assessments', 'new']); }
  history(): void {
    const woundId = resolveWoundId(this.selectedWound());
    if (woundId) void this.router.navigate(['/tabs/skin-wound', this.patientId, 'wounds', woundId, 'history']);
  }
  lastValue(points: Array<{ value: number }>): number | null { return points.length ? points.at(-1)!.value : null; }
}
