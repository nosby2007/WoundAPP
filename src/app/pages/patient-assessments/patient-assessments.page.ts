import {
  Component,
  OnInit,
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
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import {
  chevronBackOutline,
  chevronForwardOutline,
  imageOutline,
} from 'ionicons/icons';

import {
  AssessmentsService,
  MobileAssessment,
} from '../../services/assessments.service';

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
    addIcons({
      chevronBackOutline,
      chevronForwardOutline,
      imageOutline,
    });
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
