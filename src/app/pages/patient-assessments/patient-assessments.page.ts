import {
  Component,
  OnInit,
  inject,
  signal,
  computed,

} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

import {
  IonAvatar,
  IonButton,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonInput,
  IonNote,
  IonRadio,
  IonRadioGroup,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import {
  add,
  addOutline,
  bodyOutline,
  chevronBackOutline,
  chevronForwardOutline,
  imageOutline,
  locationOutline,
  logInOutline,
  logOutOutline,
  refreshOutline,
  timeOutline,
} from 'ionicons/icons';

import {
  AssessmentsService,
  MobileAssessment,
} from '../../services/assessments.service';
import { FieldVisit, VisitService } from '../../services/visit.service';
import {
  EVV_ATTESTATION_METHODS,
  EvvPatientAttestation,
  describeEvvLocation,
} from '../../shared/evv';

// Helper local pour nettoyer les ids qui ressemblent à "[Signal: xxx]"
function normalizePatientId(raw: string | null): string {
  const s = (raw ?? '').toString().trim();
  if (s.startsWith('[Signal:') && s.endsWith(']')) {
    // on enlève "[Signal:" et "]"
    return s.substring('[Signal:'.length, s.length - 1).trim();
  }
  return s;
}


@Component({
  selector: 'app-patient-assessments',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    // Ionic standalone resolves ion-* through these component classes.
    // IonicModule (the NgModule API) sat here instead, which registers
    // nothing for a standalone component: the tags fell through as
    // unknown elements and the page rendered as bare HTML.
    IonAvatar,
    IonButton,
    IonContent,
    IonFab,
    IonFabButton,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonRefresher,
    IonRefresherContent,
    IonSearchbar,
    IonSpinner,
    IonTitle,
    IonToolbar,
    IonNote,
    IonInput,
    IonRadio,
    IonRadioGroup,
  ],
  templateUrl: './patient-assessments.page.html',
  styleUrls: ['./patient-assessments.page.scss'],
})
export class PatientAssessmentsPage implements OnInit {

  patientId = normalizePatientId(this.route.snapshot.paramMap.get('patientId'));
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private assessmentsSvc: AssessmentsService,
  ) {
    // Ionic standalone has no global icon registry: every page registers
    // the icons it names, or they render blank.
    addIcons({
      add,
      addOutline,
      bodyOutline,
      chevronBackOutline,
      chevronForwardOutline,
      imageOutline,
      locationOutline,
      logInOutline,
      logOutOutline,
      refreshOutline,
      timeOutline,
    });
  }

  // ---------------------------------------------------------------- EVV

  /** The open visit for this clinician on this patient, if any. */
  openVisit = signal<FieldVisit | null>(null);
  evvBusy = signal(false);
  evvMessage = signal<string>('');

  private readonly visits = inject(VisitService);

  private async refreshOpenVisit(): Promise<void> {
    try {
      this.openVisit.set(await this.visits.openVisit(this.patientId));
    } catch {
      // A denied or failed read must not take the page down with it; the
      // buttons simply offer a check-in, and the write will report its
      // own error if it also fails.
      this.openVisit.set(null);
    }
  }

  async checkIn(): Promise<void> {
    if (this.evvBusy()) return;
    this.evvBusy.set(true);
    this.evvMessage.set('');
    try {
      const { location } = await this.visits.checkIn(this.patientId);
      await this.refreshOpenVisit();
      // Said out loud when the position did not come: the arrival IS
      // recorded, and the clinician should know the location is not.
      this.evvMessage.set(
        location.status === 'captured'
          ? 'Checked in.'
          : `Checked in — but the location was not captured (${describeEvvLocation(location).toLowerCase()}).`
      );
    } catch (error: any) {
      this.evvMessage.set(error?.message ?? 'Could not check in.');
    } finally {
      this.evvBusy.set(false);
    }
  }

  // ------------------------------------------- patient attestation

  /** The attestation panel is open, between "Check out" and confirming. */
  attesting = signal(false);
  attestMethod = signal<EvvPatientAttestation['method'] | null>(null);
  attestName = signal('');
  attestRelationship = signal('patient');
  attestReason = signal('');
  readonly attestationMethods = EVV_ATTESTATION_METHODS;

  /** Check-out asks first. The person who can attest is standing there
   *  once; the web app cannot ask them because it does not travel. */
  beginCheckOut(): void {
    if (!this.openVisit() || this.evvBusy()) return;
    this.attestMethod.set(null);
    this.attestName.set('');
    this.attestReason.set('');
    this.evvMessage.set('');
    this.attesting.set(true);
  }

  cancelAttestation(): void {
    this.attesting.set(false);
  }

  needsName(): boolean {
    return this.attestationMethods.find((m) => m.value === this.attestMethod())?.needsName ?? false;
  }

  needsReason(): boolean {
    return this.attestationMethods.find((m) => m.value === this.attestMethod())?.needsReason ?? false;
  }

  /**
   * Leave without recording one.
   *
   * Deliberately offered. An ABSENT attestation means nobody was asked,
   * which is a reportable state -- forcing a choice here would push a
   * clinician into picking 'not_required' to get out of the screen, and
   * that is a false statement rather than a missing one.
   */
  async checkOutWithoutAttestation(): Promise<void> {
    this.attesting.set(false);
    await this.checkOut(null);
  }

  async confirmAttestation(): Promise<void> {
    const method = this.attestMethod();
    if (!method) return;
    this.attesting.set(false);
    await this.checkOut({
      method,
      attestedByName: this.attestName(),
      relationship: this.attestRelationship(),
      reason: this.attestReason(),
    });
  }

  async checkOut(attestation: Parameters<VisitService['checkOut']>[2] = null): Promise<void> {
    const visit = this.openVisit();
    if (!visit || this.evvBusy()) return;
    this.evvBusy.set(true);
    this.evvMessage.set('');
    try {
      const { location } = await this.visits.checkOut(this.patientId, visit.id, attestation);
      await this.refreshOpenVisit();
      this.evvMessage.set(
        location.status === 'captured'
          ? 'Checked out.'
          : `Checked out — but the location was not captured (${describeEvvLocation(location).toLowerCase()}).`
      );
    } catch (error: any) {
      this.evvMessage.set(error?.message ?? 'Could not check out.');
    } finally {
      this.evvBusy.set(false);
    }
  }

  locationText(): string {
    return describeEvvLocation(this.openVisit()?.checkIn?.location);
  }

  patientName = signal<string>('Patient');

  loading = signal(true);
  errorMsg = signal('');
  assessments = signal<MobileAssessment[]>([]);

  search = signal('');

  filteredAssessments = computed(() => {
    const q = this.search().toLowerCase().trim();
    const list = this.assessments();
    if (!q) return list;

    return list.filter(a =>
      (a.type || '').toLowerCase().includes(q) ||
      (a.location || '').toLowerCase().includes(q) ||
      (a.stage || '').toLowerCase().includes(q)
    );
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('patientId');
      this.patientId = normalizePatientId(id);

      if (id) {
        this.load(id);
        this.loadPatient(id);
        void this.refreshOpenVisit();
      }
    });
  }

  private loadPatient(patientId: string) {
    this.assessmentsSvc.getPatient(patientId).subscribe(p => {
      if (p) this.patientName.set(p.name);
    });
  }

  load(patientId: string, ev?: CustomEvent) {
    this.loading.set(true);
    this.errorMsg.set('');

    this.assessmentsSvc.listForPatient(patientId).subscribe({
      next: list => {
        this.assessments.set(list);
        this.loading.set(false);
        ev?.detail.complete();
      },
      error: err => {
        console.error(err);
        this.errorMsg.set('Unable to load assessments');
        this.loading.set(false);
        ev?.detail.complete();
      },
    });
  }

  doRefresh(ev: CustomEvent) {
    const id = this.patientId;
    if (!id) return ev.detail.complete();
    this.load(id, ev);
  }

  formatDate(d?: Date) {
    if (!d) return '—';
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });
  }

  prettyStatus(a: MobileAssessment): string {
    switch ((a.status || 'unknown').toLowerCase()) {
      case 'new':           return 'New';
      case 'deteriorating': return 'Deteriorating';
      case 'stalled':       return 'Stalled';
      case 'stable':        return 'Stable';
      case 'improving':     return 'Improving';
      case 'monitoring':    return 'Monitoring';
      default:              return 'Unknown';
    }
  }

  openAssessment(a: MobileAssessment) {
    if (!a?.id || !this.patientId) return;
    this.router.navigate([
      '/tabs',
      'skin-wound',
      this.patientId,
      'assessments',
      a.id,
    ]);
  }

  /** Braden Scale for this patient -- a risk score, not a wound record. */
  openBraden() {
    if (!this.patientId) return;
    this.router.navigate(['/tabs', 'skin-wound', this.patientId, 'braden']);
  }

  newAssessment() {
  if (!this.patientId) return;
  this.router.navigate([
    '/tabs',
    'skin-wound',
    this.patientId,
    'assessments',
    'new',
  ]);
}

 // ✅ NOUVEAU : ouvrir l’historique de la plaie de cette évaluation
  openWoundHistory(a: MobileAssessment) {
    const woundId = a.woundId || a.id; // fallback pour les anciens docs
    this.router.navigate([
      '/tabs',
      'skin-wound',
      this.patientId,
      'wounds',
      woundId,
      'history',
    ]);
  }

   /** 🔁 Nouvelle évaluation pour cette même plaie */
  reEvaluate(a: MobileAssessment) {
    const woundId = (a as any).woundId || a.id;

    this.router.navigate(
      ['/tabs', 'skin-wound', this.patientId, 'assessments', 'new'],
      { queryParams: { woundId } },   // 🔑 c’est ça qui lie à la même plaie
    );
  }


  back() {
    this.router.navigate(['/tabs', 'patients']);
  }
}
