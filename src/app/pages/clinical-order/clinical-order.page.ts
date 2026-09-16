import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton, IonBadge, IonButton, IonButtons, IonCard, IonCardContent,
  IonCheckbox, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonNote, IonSelect,
  IonSelectOption, IonSpinner, IonTitle, IonToggle, IonToolbar, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { documentTextOutline, shieldCheckmarkOutline } from 'ionicons/icons';
import {
  MobileCareAlgorithm, MobileOrderReceiptMethod, MobileOrderService,
  MobilePrescriber, MobileTreatmentProtocolSections, MobileTreatmentProtocolTemplate, MobileWoundOption,
} from '../../services/mobile-order.service';
import { ClinicalIdentityService, ClinicalIdentitySnapshot } from '../../services/clinical-identity.service';
import { MobileAlgorithmGuidance, deriveMobileAlgorithmGuidance } from '../../shared/mobile-order-guidance';
import { clinicalVisitQueryParams } from '../../shared/clinical-visit-link';

@Component({
  selector: 'app-clinical-order',
  standalone: true,
  imports: [CommonModule, FormsModule, IonBackButton, IonBadge, IonButton, IonButtons,
    IonCard, IonCardContent, IonCheckbox, IonContent, IonHeader, IonIcon, IonItem, IonLabel,
    IonNote, IonSelect, IonSelectOption, IonSpinner, IonTitle, IonToggle, IonToolbar],
  template: `
  <ion-header class="ion-no-border"><ion-toolbar>
    <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/patients"></ion-back-button></ion-buttons>
    <ion-title>Clinical Order</ion-title>
  </ion-toolbar></ion-header>
  <ion-content>
    <div class="page">
      <section class="hero"><p class="eyebrow">ORG-GOVERNED ORDERING</p><h1>Place from a published care algorithm</h1>
        <p>Clinical content comes from algorithms published by your organization admin. Mobile does not invent treatment instructions.</p></section>

      <ion-card *ngIf="loading"><ion-card-content class="center"><ion-spinner></ion-spinner> Loading clinical catalog…</ion-card-content></ion-card>
      <ion-card *ngIf="!loading && error"><ion-card-content class="error">{{ error }}</ion-card-content></ion-card>

      <ng-container *ngIf="!loading && !error">
        <ion-card>
          <ion-card-content>
            <p class="eyebrow dark">1 · TARGET</p>
            <ion-item lines="full">
              <ion-select label="Wound (optional)" labelPlacement="stacked" [(ngModel)]="woundId" (ionChange)="onWoundChanged()" placeholder="Patient-level order">
                <ion-select-option value="">Patient-level / no wound link</ion-select-option>
                <ion-select-option *ngFor="let wound of wounds" [value]="wound.woundId">{{ wound.label }}</ion-select-option>
              </ion-select>
            </ion-item>
          </ion-card-content>
        </ion-card>

        <ion-card>
          <ion-card-content>
            <p class="eyebrow dark">2 · CLINICAL CATEGORY GUIDANCE</p>
            <div class="notice" *ngIf="guidance">
              JADE/WoundAPP uses the latest documented assessment only to suggest protocol categories. It does not choose treatment or place an order.
            </div>
            <div class="guidance" *ngIf="guidance">
              <button type="button" *ngFor="let type of guidance.suggestedTypes"
                class="guidance-chip"
                [class.active]="selectedWoundType === type"
                (click)="chooseWoundType(type)">
                {{ type }}
              </button>
              <div class="guidance-reason" *ngFor="let reason of guidance.rationale">• {{ reason }}</div>
              <div class="guidance-caution" *ngFor="let caution of guidance.cautions">{{ caution }}</div>
            </div>
            <ion-item lines="full">
              <ion-select label="Protocol category" labelPlacement="stacked" [(ngModel)]="selectedWoundType" (ionChange)="chooseWoundType($event.detail.value)" placeholder="Provider selects category">
                <ion-select-option value="">All published categories</ion-select-option>
                <ion-select-option *ngFor="let algorithm of filteredAlgorithms" [value]="algorithm.woundType">{{ algorithm.woundType }}</ion-select-option>
              </ion-select>
            </ion-item>
          </ion-card-content>
        </ion-card>

        <ion-card>
          <ion-card-content>
            <p class="eyebrow dark">3 · PUBLISHED ALGORITHM</p>
            <ion-item lines="full">
              <ion-select label="Algorithm" labelPlacement="stacked" [(ngModel)]="algorithmId" (ionChange)="onAlgorithmChanged()" placeholder="Select published protocol">
                <ion-select-option *ngFor="let algorithm of algorithms" [value]="algorithm.id">{{ algorithm.name }} · {{ algorithm.woundType }}</ion-select-option>
              </ion-select>
            </ion-item>
            <div class="empty" *ngIf="!algorithms.length">No published care algorithms are available for this organization. An org admin must publish one before it can be used here.</div>
            <div class="preview" *ngIf="selectedAlgorithm">
              <div class="preview-head"><ion-icon [icon]="documentTextOutline"></ion-icon><strong>{{ selectedAlgorithm.name }}</strong><ion-badge>{{ selectedAlgorithm.woundType }}</ion-badge></div>
              <pre>{{ preview }}</pre>
            </div>
          </ion-card-content>
        </ion-card>

        <ion-card *ngIf="selectedAlgorithm">
          <ion-card-content>
            <p class="eyebrow dark">4 · TREATMENT TEMPLATE</p>
            <div class="notice">Select an admin-published treatment model. The template defines the approved choices; you still select the final treatment items.</div>
            <ion-item lines="full" *ngIf="filteredTreatmentTemplates.length">
              <ion-select label="Treatment protocol" labelPlacement="stacked" [(ngModel)]="treatmentTemplateId" (ionChange)="onTreatmentTemplateChanged()" placeholder="Select treatment model">
                <ion-select-option *ngFor="let template of filteredTreatmentTemplates" [value]="template.id">{{ template.name }} · v{{ template.version || 1 }}</ion-select-option>
              </ion-select>
            </ion-item>
            <div class="empty" *ngIf="!filteredTreatmentTemplates.length">No published treatment template for this algorithm category. An administrator can publish one in JADE Admin → Treatment protocols.</div>

            <div class="template-preview" *ngIf="selectedTreatmentTemplate as template">
              <div class="preview-head"><ion-icon [icon]="documentTextOutline"></ion-icon><strong>{{ template.name }}</strong><ion-badge>v{{ template.version || 1 }}</ion-badge></div>
              <p class="template-default" *ngIf="template.orderDefaults?.frequency">Default frequency: <strong>{{ template.orderDefaults.frequency }}</strong></p>

              <div class="template-section" *ngIf="protocolOptions('specialInstructions').length">
                <h3>Special instructions</h3>
                <ion-item lines="none" *ngFor="let option of protocolOptions('specialInstructions')">
                  <ion-checkbox slot="start" [checked]="isProtocolOptionSelected('specialInstructions', option.label)" (ionChange)="toggleProtocolOption('specialInstructions', option.label, $event.detail.checked)"></ion-checkbox>
                  <ion-label>{{ option.label }}</ion-label>
                </ion-item>
              </div>
              <div class="template-section" *ngIf="protocolOptions('cleanse').length">
                <h3>Cleanse</h3>
                <ion-item lines="none" *ngFor="let option of protocolOptions('cleanse')">
                  <ion-checkbox slot="start" [checked]="isProtocolOptionSelected('cleanse', option.label)" (ionChange)="toggleProtocolOption('cleanse', option.label, $event.detail.checked)"></ion-checkbox>
                  <ion-label>{{ option.label }}</ion-label>
                </ion-item>
              </div>
              <div class="template-section" *ngIf="protocolOptions('prep').length">
                <h3>Prep / periwound</h3>
                <ion-item lines="none" *ngFor="let option of protocolOptions('prep')">
                  <ion-checkbox slot="start" [checked]="isProtocolOptionSelected('prep', option.label)" (ionChange)="toggleProtocolOption('prep', option.label, $event.detail.checked)"></ion-checkbox>
                  <ion-label>{{ option.label }}</ion-label>
                </ion-item>
              </div>
              <div class="template-section" *ngIf="protocolOptions('fillApply').length">
                <h3>Fill / Apply</h3>
                <ion-item lines="none" *ngFor="let option of protocolOptions('fillApply')">
                  <ion-checkbox slot="start" [checked]="isProtocolOptionSelected('fillApply', option.label)" (ionChange)="toggleProtocolOption('fillApply', option.label, $event.detail.checked)"></ion-checkbox>
                  <ion-label>{{ option.label }}</ion-label>
                </ion-item>
              </div>
              <div class="template-section" *ngIf="protocolOptions('cover').length">
                <h3>Cover</h3>
                <ion-item lines="none" *ngFor="let option of protocolOptions('cover')">
                  <ion-checkbox slot="start" [checked]="isProtocolOptionSelected('cover', option.label)" (ionChange)="toggleProtocolOption('cover', option.label, $event.detail.checked)"></ion-checkbox>
                  <ion-label>{{ option.label }}</ion-label>
                </ion-item>
              </div>
              <div class="template-section" *ngIf="protocolOptions('secureWith').length">
                <h3>Secure with</h3>
                <ion-item lines="none" *ngFor="let option of protocolOptions('secureWith')">
                  <ion-checkbox slot="start" [checked]="isProtocolOptionSelected('secureWith', option.label)" (ionChange)="toggleProtocolOption('secureWith', option.label, $event.detail.checked)"></ion-checkbox>
                  <ion-label>{{ option.label }}</ion-label>
                </ion-item>
              </div>
              <div class="template-section" *ngIf="protocolOptions('changePrn').length">
                <h3>Change / PRN</h3>
                <ion-item lines="none" *ngFor="let option of protocolOptions('changePrn')">
                  <ion-checkbox slot="start" [checked]="isProtocolOptionSelected('changePrn', option.label)" (ionChange)="toggleProtocolOption('changePrn', option.label, $event.detail.checked)"></ion-checkbox>
                  <ion-label>{{ option.label }}</ion-label>
                </ion-item>
              </div>
            </div>
          </ion-card-content>
        </ion-card>

        <ion-card>
          <ion-card-content>
            <p class="eyebrow dark">5 · ORDER PROVENANCE</p>
            <div class="identity"><ion-icon [icon]="shieldCheckmarkOutline"></ion-icon><div><strong>{{ identity?.displayName }}</strong><small>{{ identity?.credentials || identity?.role }}</small></div></div>
            <div *ngIf="isPrescriber" class="notice">You are documenting this order directly as the prescriber.</div>
            <ng-container *ngIf="!isPrescriber">
              <ion-item lines="full">
                <ion-select label="How was the order received?" labelPlacement="stacked" [(ngModel)]="receiptMethod">
                  <ion-select-option value="telephone">Telephone</ion-select-option>
                  <ion-select-option value="verbal">Verbal</ion-select-option>
                </ion-select>
              </ion-item>
              <ion-item lines="full">
                <ion-select label="Prescriber" labelPlacement="stacked" [(ngModel)]="prescriberUid" placeholder="Select provider / NP">
                  <ion-select-option *ngFor="let p of prescribers" [value]="p.uid">{{ p.displayName }}{{ p.credentials ? ' · ' + p.credentials : '' }}</ion-select-option>
                </ion-select>
              </ion-item>
              <ion-item lines="none"><ion-toggle [(ngModel)]="readBackConfirmed">Read-back confirmed</ion-toggle></ion-item>
              <ion-note>A telephone/verbal order is recorded with an outstanding co-signature for the selected prescriber.</ion-note>
            </ng-container>
          </ion-card-content>
        </ion-card>

        <ion-button expand="block" size="large" [disabled]="saving || !selectedAlgorithm || (filteredTreatmentTemplates.length > 0 && !selectedTreatmentTemplate) || (!isPrescriber && (!prescriberUid || !readBackConfirmed))" (click)="save()">
          <ion-spinner *ngIf="saving" name="crescent"></ion-spinner><span *ngIf="!saving">Place order</span>
        </ion-button>
      </ng-container>
    </div>
  </ion-content>`,
  styles: [`
    .page{max-width:820px;margin:0 auto;padding:16px 14px 40px;background:#f4f7f9;min-height:100%}.hero{padding:22px;border-radius:24px;background:linear-gradient(145deg,#0d7657,#173f60);color:#fff;margin-bottom:14px}.hero h1{font-size:25px;margin:5px 0}.hero p{margin:0;opacity:.82;line-height:1.45}.eyebrow{font-size:10px;font-weight:800;letter-spacing:.14em;margin:0}.eyebrow.dark{color:#63788e;margin-bottom:8px}ion-card{border-radius:20px;box-shadow:0 5px 22px rgba(18,46,67,.06);margin:12px 0}.preview{background:#f4f8fa;border-radius:16px;padding:13px;margin-top:14px}.preview-head{display:flex;gap:8px;align-items:center;color:#173f60}.preview-head ion-badge{margin-left:auto}pre{white-space:pre-wrap;font-family:inherit;font-size:12px;line-height:1.5;color:#334155}.identity{display:flex;gap:10px;align-items:center;padding:12px;background:#eef7f3;border-radius:14px}.identity ion-icon{font-size:24px;color:#087455}.identity small{display:block;color:#64748b}.notice,.empty,.error{padding:12px;border-radius:12px;margin-top:10px}.template-preview{margin-top:14px;border:1px solid #dce8e3;border-radius:16px;padding:12px}.template-section{margin-top:12px}.template-section h3{font-size:13px;color:#173f60;margin:8px 4px}.template-section ion-item{--padding-start:0;font-size:13px}.template-default{font-size:12px;color:#52687c}.notice{background:#eef7f3;color:#245d49}.guidance{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.guidance-chip{border:1px solid #8fb8d8;background:#fff;color:#173f60;border-radius:999px;padding:7px 10px;font-size:12px}.guidance-chip.active{background:#e8f3fb;border-color:#2d78b7}.guidance-reason{width:100%;font-size:12px;color:#42566b}.guidance-caution{width:100%;font-size:11px;background:#fff7e8;color:#7a4a0d;padding:8px 10px;border-radius:10px}.empty{background:#f8fafc;color:#64748b}.error{background:#fff1f0;color:#9d2b25}.center{display:flex;gap:10px;align-items:center}
  `],
})
export class ClinicalOrderPage implements OnInit {
  private route = inject(ActivatedRoute); private router = inject(Router);
  private orderService = inject(MobileOrderService); private identityService = inject(ClinicalIdentityService);
  private toast = inject(ToastController);
  patientId = this.route.snapshot.paramMap.get('patientId') || '';
  appointmentId = this.route.snapshot.queryParamMap.get('appointmentId') || '';
  woundVisitId = this.route.snapshot.queryParamMap.get('woundVisitId') || '';
  episodeId = this.route.snapshot.queryParamMap.get('episodeId') || '';
  loading = true; saving = false; error = '';
  algorithms: MobileCareAlgorithm[] = []; treatmentTemplates: MobileTreatmentProtocolTemplate[] = []; prescribers: MobilePrescriber[] = []; wounds: MobileWoundOption[] = [];
  identity: ClinicalIdentitySnapshot | null = null; algorithmId = ''; woundId = ''; selectedAlgorithm: MobileCareAlgorithm | null = null; woundLabel = '';
  treatmentTemplateId = ''; selectedTreatmentTemplate: MobileTreatmentProtocolTemplate | null = null;
  treatmentSelections: Partial<Record<keyof MobileTreatmentProtocolSections, string[]>> = {};
  guidance: MobileAlgorithmGuidance | null = null; selectedWoundType = '';
  receiptMethod: MobileOrderReceiptMethod = 'telephone'; prescriberUid = ''; readBackConfirmed = false;
  readonly documentTextOutline = documentTextOutline; readonly shieldCheckmarkOutline = shieldCheckmarkOutline;

  constructor(){ addIcons({ documentTextOutline, shieldCheckmarkOutline }); }
  get isPrescriber(){ return ['provider','np'].includes(String(this.identity?.role || '').toLowerCase()); }
  get preview(){ return this.selectedAlgorithm ? this.orderService.renderAlgorithm(this.selectedAlgorithm) : ''; }
  get filteredAlgorithms(){ return this.selectedWoundType ? this.algorithms.filter(a => a.woundType === this.selectedWoundType) : this.algorithms; }
  get filteredTreatmentTemplates(){
    const woundType = this.selectedAlgorithm?.woundType || this.selectedWoundType;
    const category = this.orderService.treatmentCategoryForWoundType(woundType || '');
    return category ? this.treatmentTemplates.filter(t => t.category === category) : [];
  }
  get selectedTypeMatchedGuidance(){ return !!this.selectedWoundType && (this.guidance?.suggestedTypes.includes(this.selectedWoundType) ?? false); }

  async ngOnInit(){
    try {
      this.identity = await this.identityService.requireCurrentIdentity();
      [this.algorithms, this.treatmentTemplates, this.prescribers, this.wounds] = await Promise.all([
        this.orderService.listPublishedAlgorithms(),
        this.orderService.listPublishedTreatmentProtocols(),
        this.orderService.listPrescribers(),
        this.orderService.listWounds(this.patientId)
      ]);
    } catch(e:any){ this.error = e?.message || 'Clinical ordering workspace could not be loaded.'; }
    finally { this.loading = false; }
  }
  onAlgorithmChanged(){
    this.selectedAlgorithm = this.filteredAlgorithms.find(a => a.id === this.algorithmId) || null;
    this.treatmentTemplateId = '';
    this.selectedTreatmentTemplate = null;
    this.treatmentSelections = {};
  }

  onTreatmentTemplateChanged(){
    this.selectedTreatmentTemplate = this.filteredTreatmentTemplates.find(t => t.id === this.treatmentTemplateId) || null;
    this.treatmentSelections = {};
    if (!this.selectedTreatmentTemplate) return;
    const sections = this.selectedTreatmentTemplate.sections;
    (Object.keys(sections) as Array<keyof MobileTreatmentProtocolSections>).forEach((section) => {
      this.treatmentSelections[section] = (sections[section] || []).filter(o => o.selectedByDefault).map(o => o.label);
    });
  }

  protocolOptions(section: keyof MobileTreatmentProtocolSections){
    return this.selectedTreatmentTemplate?.sections?.[section] || [];
  }

  isProtocolOptionSelected(section: keyof MobileTreatmentProtocolSections, label: string): boolean {
    return (this.treatmentSelections[section] || []).includes(label);
  }

  toggleProtocolOption(section: keyof MobileTreatmentProtocolSections, label: string, checked: boolean): void {
    const current = this.treatmentSelections[section] || [];
    this.treatmentSelections[section] = checked
      ? Array.from(new Set([...current, label]))
      : current.filter(value => value !== label);
  }
  onWoundChanged(){
    const wound = this.wounds.find(w => w.woundId === this.woundId) || null;
    this.woundLabel = wound?.label || '';
    this.guidance = deriveMobileAlgorithmGuidance(wound?.guidanceInput);
    this.algorithmId = '';
    this.selectedAlgorithm = null;
    this.treatmentTemplateId = '';
    this.selectedTreatmentTemplate = null;
    this.treatmentSelections = {};
    this.selectedWoundType = '';
  }
  chooseWoundType(type: string){
    this.selectedWoundType = type;
    this.algorithmId = '';
    this.selectedAlgorithm = null;
    this.treatmentTemplateId = '';
    this.selectedTreatmentTemplate = null;
    this.treatmentSelections = {};
  }
  async save(){
    if(!this.selectedAlgorithm || this.saving) return; this.saving = true;
    try {
      await this.orderService.createAlgorithmOrder(this.patientId, {
        algorithm: this.selectedAlgorithm,
        woundId: this.woundId || null,
        woundLabel: this.woundLabel || null,
        receiptMethod: this.isPrescriber ? 'direct' : this.receiptMethod,
        prescriberUid: this.prescriberUid || null,
        readBackConfirmed: this.readBackConfirmed,
        guidance: this.guidance,
        selectedTypeMatchedGuidance: this.selectedTypeMatchedGuidance,
        treatmentProtocol: this.selectedTreatmentTemplate,
        treatmentSelections: this.treatmentSelections,
        visitLink: {
          visitId: this.woundVisitId || null,
          appointmentId: this.appointmentId || null,
          woundId: this.woundId || null,
          episodeId: this.episodeId || null,
          fieldEncounterVisitId: this.woundVisitId || null,
        },
      });
      const t = await this.toast.create({ message:'Order saved to patient chart', duration:2200, color:'success' }); await t.present();
      await this.router.navigate(['/tabs','skin-wound',this.patientId,'assessments'], {
        queryParams: clinicalVisitQueryParams({
          visitId: this.woundVisitId || null,
          appointmentId: this.appointmentId || null,
          woundId: this.woundId || null,
          episodeId: this.episodeId || null,
        }),
      });
    } catch(e:any){ const t = await this.toast.create({message:e?.message || 'Order could not be saved', duration:3200, color:'danger'}); await t.present(); }
    finally { this.saving = false; }
  }
}
