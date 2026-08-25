// src/app/pages/assessment-form/assessment-form.page.ts
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ToastController,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { AssessmentsService } from '../../services/assessments.service';
import { getAuth } from 'firebase/auth';
import { take } from 'rxjs/operators';



@Component({
  selector: 'app-assessment-form',
  standalone: true,
  templateUrl: './assessment-form.page.html',
  styleUrls: ['./assessment-form.page.scss'],
  imports: [ CommonModule, ReactiveFormsModule, RouterModule,
    // Ionic standalone resolves ion-* through these component classes.
    // IonicModule (the NgModule API) sat here instead, which registers
    // nothing for a standalone component: the tags fell through as
    // unknown elements and the page rendered as bare HTML.
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonSelect,
    IonSelectOption,
    IonSpinner,
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

  
woundTypes: string[] = [
  'Pressure',
  'Skin Tear',
  'Diabetic',
  'Venous',
  'Arterial',
  'Surgical',
  'MASD',
  'Rash',
  'Blister',
  'Laceration',
  'Open Lesion',
  'Hematoma',
  'Burn',
  'Abscess',
  'Ischemic',
  'Neuropathic',
  'Cancer Lesion',
  'Moisture Associated Skin Damage (MASD)',
  'Pressure - Kennedy Terminal Ulcer',
  'Pressure - Medical Device Related Pressure Injury',
  'Other'
];

stages: string[] = [
  'Stage 1',
  'Stage 2',
  'Stage 3',
  'Stage 4',
  'Deep Tissue Injury',
  'Mucosal Membrane',
  'Unstageable'
];

acquiredOptions: string[] = [
  'In-House Acquired',
  'Present on Admission'
];

statusOptions: string[] = [
  'New',
  'Improving',
  'Stable',
  'Stalled',
  'Deteriorating',
  'Monitoring',
  'Resolved'
];


  loading = false;

   form = this.fb.group({
   type: ['Pressure', Validators.required],
  stage: [''],
  location: ['', Validators.required],
  acquired: ['In-House Acquired'],
  status: ['New', Validators.required],
  });

  photoPreview?: string;    // pour l’affichage
  private photoDataUrl?: string; // envoyé à Firebase

  // 🟢 AU CHARGEMENT : si on a assessmentId → on charge les données existantes
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
            console.warn(
              '[AssessmentForm] No doc found for edit',
              this.patientId,
              this.assessmentId
            );
            this.loading = false;
            return;
          }

          // 🧩 Pré-remplir le formulaire
          this.form.patchValue({
            type: data.describe?.type || data.type || '',
            stage: data.describe?.stage || data.stage || '',
            location: data.describe?.location || data.location || '',
            acquired: data.describe?.acquired || data.acquired || '',
            status: data.progress?.status || data.status || 'open',
          });

          // 📸 si une photo existe déjà
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

    console.log('[AssessmentForm] currentUser uid =', uid);

    if (!uid) {
      throw new Error('No logged user uid (user not authenticated)');
    }

    const now = new Date();

    // 🧠 1) Construire un payload qui ressemble au WoundAssessment de la web-app
    const basePayload: any = {
      patientId: this.patientId,

      // meta/audit
      createdAt: now,
      assessedAt: now,
      updatedAt: now,

      createdBy: uid,         // pour les rules (canCreateSub)
      createdByUid: uid,      // pour la web app
      createdByName: displayName || 'Nurse',

      // section describe (on alimente ce que le mobile connaît)
      describe: {
        type: this.form.value.type || 'Other',
        stage: this.form.value.stage || null,
        location: this.form.value.location || '',
        acquired: this.form.value.acquired || 'In-House Acquired',
        ageCategory: '',      // on laisse vide pour l’instant
        exactDate: null,
        stagedBy: 'In-house nursing',
        notes: '',
      },

      // measurements : valeurs par défaut (0)
      measurements: {
        area: 0,
        length: 0,
        width: 0,
        depth: 0,
        undermining: '',
        tunneling: '',
      },

      // woundBed : tout neutre
      woundBed: {
        epithelial: false,
        granulation: { present: false, percent: 0 },
        slough: { present: false, percent: 0 },
        eschar: false,
        infection: [],
        other: [],
        otherNote: '',
      },

      // exudate : neutre
      exudate: {
        amount: 'None',
        type: 'None',
        odor: 'None',
      },

      // periwound : valeurs par défaut
      periwound: {
        edges: 'Attached',
        surrounding: [],
        induration: 'None present',
        edema: 'No swelling or edema',
        temperature: 'Normal',
      },

      // pain : neutre
      pain: {
        cognitivelyImpaired: false,
        score: 0,
        frequency: 'None',
        notes: '',
      },

      // orders : valeur par défaut
      orders: {
        goalOfCare: 'Healable',
      },

      // treatment : vides pour l’instant
      treatment: {
        dressingAppearance: 'Intact',
        cleansing: '',
        debridement: '',
        primary: '',
        secondary: '',
        modalities: '',
        additionalCare: [],
      },

      // progress : alimente status depuis la form
      progress: {
        status: (this.form.value.status as any) || 'New',
        infection: 'None',
        notes: '',
        education: '',
      },

      // placeholder pour la photo
      photoURL: null,
    };

    let id = this.assessmentId;

    // 2️⃣ NEW ou EDIT ?
    if (!id) {
      // ➕ NEW : on crée le doc dans patients/{patientId}/woundAssessments
      id = await this.assessments.create(this.patientId, basePayload);
      console.log('[AssessmentForm] created new assessment id =', id);
    } else {
      // ✏️ EDIT : on met juste à jour (sans toucher createdAt / createdBy)
      basePayload.updatedAt = now;
      delete basePayload.createdAt;
      delete basePayload.createdBy;
      delete basePayload.createdByUid;
      delete basePayload.createdByName;

      await this.assessments.update(this.patientId, id, basePayload);
      console.log('[AssessmentForm] updated assessment id =', id);
    }

    // 3️⃣ upload photo si besoin
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

    // retour à la liste
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