import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonSpinner, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { addOutline, analyticsOutline, locateOutline } from 'ionicons/icons';
import { AssessmentsService, MobileAssessment } from '../../services/assessments.service';
import { bodyProfileFromPatientGender, BodyProfile, WoundAnatomyPosition, WoundMapMarker } from '../../shared/wound-anatomy';
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
  readonly patientProfile = signal<BodyProfile | null>(null);
  readonly assessments = signal<MobileAssessment[]>([]);
  readonly selectedWoundId = signal('');
  readonly saving = signal(false);
  readonly notice = signal('');

  readonly allWoundGroups = computed(() => groupAssessmentsByWound(this.assessments()));
  readonly woundGroups = computed(() => this.allWoundGroups().filter(group => group.latest.woundLifecycleStatus !== 'archived'));
  readonly archivedWoundGroups = computed(() => this.allWoundGroups().filter(group => group.latest.woundLifecycleStatus === 'archived'));
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
      if (patient) {
        this.patientName.set(patient.name);
        this.patientProfile.set(bodyProfileFromPatientGender(patient.gender));
      }
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
  placeSticker(position: WoundAnatomyPosition): void {
    void this.router.navigate(
      ['/tabs/skin-wound', this.patientId, 'assessments', 'new'],
      { queryParams: { anatomyZone: position.id, anatomyProfile: position.profile, fromBodyMap: '1' } },
    );
  }
  async moveSticker(event: { marker: WoundMapMarker; position: WoundAnatomyPosition }): Promise<void> {
    const latest = this.latestWounds().find(item => resolveWoundId(item) === event.marker.woundId);
    if (!latest || this.saving()) return;
    this.saving.set(true);
    this.notice.set('');
    try {
      await this.assessmentsService.updateWoundAnatomy(this.patientId, latest.id, event.marker.woundId, event.position);
      this.notice.set(`Wound moved to ${event.position.label}.`);
    } catch {
      this.notice.set('The wound sticker could not be moved. Please retry.');
    } finally {
      this.saving.set(false);
    }
  }
  async archiveSelected(): Promise<void> {
    const wound = this.selectedWound();
    const woundId = resolveWoundId(wound);
    if (!wound || !woundId || this.saving()) return;
    if (!window.confirm('Remove this sticker from the active body map and archive the wound? Its history will remain available.')) return;
    this.saving.set(true);
    this.notice.set('');
    try {
      await this.assessmentsService.setWoundArchived(this.patientId, wound.id, woundId, true);
      this.selectedWoundId.set('');
      this.notice.set('Wound archived. It can be reactivated below if it reopens.');
    } catch {
      this.notice.set('The wound could not be archived. Please retry.');
    } finally {
      this.saving.set(false);
    }
  }
  async reactivate(wound: MobileAssessment): Promise<void> {
    const woundId = resolveWoundId(wound);
    if (!woundId || this.saving()) return;
    this.saving.set(true);
    this.notice.set('');
    try {
      await this.assessmentsService.setWoundArchived(this.patientId, wound.id, woundId, false);
      this.selectedWoundId.set(woundId);
      this.notice.set('Wound reactivated and restored to the body map.');
    } catch {
      this.notice.set('The wound could not be reactivated. Please retry.');
    } finally {
      this.saving.set(false);
    }
  }
  fullChart(): void {
    void this.router.navigate(['/tabs/skin-wound', this.patientId, 'assessments'], { queryParams: this.route.snapshot.queryParams });
  }
  history(): void {
    const woundId = resolveWoundId(this.selectedWound());
    if (woundId) void this.router.navigate(['/tabs/skin-wound', this.patientId, 'wounds', woundId, 'history']);
  }
  lastValue(points: Array<{ value: number }>): number | null { return points.length ? points.at(-1)!.value : null; }
}
