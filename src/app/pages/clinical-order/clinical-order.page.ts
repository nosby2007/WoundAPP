import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  IonBackButton, IonBadge, IonButton, IonButtons, IonCard, IonCardContent,
  IonCheckbox, IonContent, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonNote, IonSelect,
  IonSelectOption, IonSpinner, IonTextarea, IonTitle, IonToggle, IonToolbar, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { documentTextOutline, shieldCheckmarkOutline } from 'ionicons/icons';
import {
  MobileClinicalOrderRow, MobileOrderReceiptMethod, MobileOrderService,
  MobilePrescriber, MobileTreatmentProtocolSections, MobileTreatmentProtocolTemplate, MobileWoundOption,
} from '../../services/mobile-order.service';
import { ClinicalIdentityService, ClinicalIdentitySnapshot } from '../../services/clinical-identity.service';
import { MobileAlgorithmGuidance, deriveMobileAlgorithmGuidance } from '../../shared/mobile-order-guidance';

@Component({
  selector: 'app-clinical-order',
  standalone: true,
  imports: [CommonModule, FormsModule, IonBackButton, IonBadge, IonButton, IonButtons,
    IonCard, IonCardContent, IonCheckbox, IonContent, IonHeader, IonIcon, IonInput, IonItem, IonLabel,
    IonNote, IonSelect, IonSelectOption, IonSpinner, IonTextarea, IonTitle, IonToggle, IonToolbar],
  template: `
  <ion-header class="ion-no-border"><ion-toolbar>
    <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/patients"></ion-back-button></ion-buttons>
    <ion-title>Clinical Order</ion-title>
  </ion-toolbar></ion-header>
  <ion-content>
    <div class="page">
      <section class="hero"><p class="eyebrow">ORG-GOVERNED ORDERING</p><h1>Place from a published treatment protocol</h1>
        <p>Clinical content comes from treatment protocol templates published by your organization admin. WoundAPP uses assessment data only to guide the category.</p></section>

      <ion-card *ngIf="loading"><ion-card-content class="center"><ion-spinner></ion-spinner> Loading clinical catalog…</ion-card-content></ion-card>
      <ion-card *ngIf="!loading && error"><ion-card-content class="error">{{ error }}</ion-card-content></ion-card>

      <ng-container *ngIf="!loading && !error">
        <ion-card>
          <ion-card-content>
            <p class="eyebrow dark">CURRENT ORDERS</p>
            <div class="current-orders" *ngIf="orders.length; else noCurrentOrders">
              <div class="order-row" *ngFor="let order of orders">
                <div>
                  <strong>{{ order.treatmentProtocol?.templateName || order.orderType }}</strong>
                  <span>{{ order.description }}</span>
                </div>
                <ion-badge>{{ order.workflow?.state || 'created' }}</ion-badge>
              </div>
            </div>
            <ng-template #noCurrentOrders>
              <div class="empty">No current orders are linked to this encounter yet.</div>
            </ng-template>
          </ion-card-content>
        </ion-card>

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
                <ion-select-option *ngFor="let category of treatmentCategories" [value]="category">{{ category }}</ion-select-option>
              </ion-select>
            </ion-item>
          </ion-card-content>
        </ion-card>

        <ion-card *ngIf="selectedWoundType">
          <ion-card-content>
            <p class="eyebrow dark">3 · TREATMENT PROTOCOL</p>
            <div class="notice">Select an admin-published treatment model. The template defines the approved choices; you still select the final treatment items.</div>
            <ion-item lines="full" *ngIf="filteredTreatmentTemplates.length">
              <ion-select label="Treatment protocol" labelPlacement="stacked" [(ngModel)]="treatmentTemplateId" (ionChange)="onTreatmentTemplateChanged()" placeholder="Select treatment model">
                <ion-select-option *ngFor="let template of filteredTreatmentTemplates" [value]="template.id">{{ template.name }} · v{{ template.version || 1 }}</ion-select-option>
              </ion-select>
            </ion-item>
            <div class="empty" *ngIf="!filteredTreatmentTemplates.length">No published treatment protocol for this selected category. An administrator can publish one in JADE Admin → Treatment protocols.</div>

            <div class="template-preview" *ngIf="selectedTreatmentTemplate as template">
              <div class="preview-head"><ion-icon [icon]="documentTextOutline"></ion-icon><strong>{{ template.name }}</strong><ion-badge>v{{ template.version || 1 }}</ion-badge></div>
              <p>{{ template.description || 'Admin-published treatment protocol.' }}</p>
              <p class="template-default" *ngIf="template.orderDefaults?.frequency">Default frequency: <strong>{{ template.orderDefaults.frequency }}</strong></p>
              <p class="template-default">The protocol supplies the approved choices. Build and review the executable routine below.</p>
            </div>
          </ion-card-content>
        </ion-card>

        <ion-card *ngIf="selectedTreatmentTemplate">
          <ion-card-content>
            <p class="eyebrow dark">4 · BUILD ROUTINE</p>
            <div class="notice">Confirm the execution details for this order. The selected treatment protocol provides the available choices; the final routine is provider-reviewed.</div>

            <ion-item lines="full">
              <ion-select label="Wound management" labelPlacement="stacked" [(ngModel)]="routineWoundManagement">
                <ion-select-option *ngFor="let option of woundManagementOptions" [value]="option">{{ option }}</ion-select-option>
              </ion-select>
            </ion-item>

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
              <h3>Secure</h3>
              <ion-item lines="none" *ngFor="let option of protocolOptions('secureWith')">
                <ion-checkbox slot="start" [checked]="isProtocolOptionSelected('secureWith', option.label)" (ionChange)="toggleProtocolOption('secureWith', option.label, $event.detail.checked)"></ion-checkbox>
                <ion-label>{{ option.label }}</ion-label>
              </ion-item>
            </div>

            <ion-item lines="full">
              <ion-select label="Frequency" labelPlacement="stacked" [(ngModel)]="routineFrequency">
                <ion-select-option *ngFor="let option of frequencyOptions" [value]="option">{{ option }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item lines="full">
              <ion-input label="Start date" labelPlacement="stacked" type="date" [(ngModel)]="routineStartDate"></ion-input>
            </ion-item>
            <ion-item lines="full">
              <ion-input label="Duration" labelPlacement="stacked" [(ngModel)]="routineDuration" placeholder="Until discontinued"></ion-input>
            </ion-item>

            <div class="template-section" *ngIf="protocolOptions('changePrn').length">
              <h3>Change / PRN</h3>
              <ion-item lines="none" *ngFor="let option of protocolOptions('changePrn')">
                <ion-checkbox slot="start" [checked]="isProtocolOptionSelected('changePrn', option.label)" (ionChange)="toggleProtocolOption('changePrn', option.label, $event.detail.checked)"></ion-checkbox>
                <ion-label>{{ option.label }}</ion-label>
              </ion-item>
            </div>

            <ion-item lines="full">
              <ion-textarea label="Provider comments / parameters" labelPlacement="stacked" autoGrow="true" [(ngModel)]="routineComments"></ion-textarea>
            </ion-item>

            <div class="routine-preview">
              <strong>Generated routine</strong>
              <p>{{ routinePreview }}</p>
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

        <ion-button expand="block" size="large" [disabled]="saving || !selectedWoundType || !selectedTreatmentTemplate || (!isPrescriber && (!prescriberUid || !readBackConfirmed))" (click)="save()">
          <ion-spinner *ngIf="saving" name="crescent"></ion-spinner><span *ngIf="!saving">Place order</span>
        </ion-button>
      </ng-container>
    </div>
  </ion-content>`,
  styles: [`
    .page{max-width:820px;margin:0 auto;padding:16px 14px 40px;background:#f4f7f9;min-height:100%}.hero{padding:22px;border-radius:24px;background:linear-gradient(145deg,#0d7657,#173f60);color:#fff;margin-bottom:14px}.hero h1{font-size:25px;margin:5px 0}.hero p{margin:0;opacity:.82;line-height:1.45}.eyebrow{font-size:10px;font-weight:800;letter-spacing:.14em;margin:0}.eyebrow.dark{color:#63788e;margin-bottom:8px}ion-card{border-radius:20px;box-shadow:0 5px 22px rgba(18,46,67,.06);margin:12px 0}.preview{background:#f4f8fa;border-radius:16px;padding:13px;margin-top:14px}.preview-head{display:flex;gap:8px;align-items:center;color:#173f60}.preview-head ion-badge{margin-left:auto}pre{white-space:pre-wrap;font-family:inherit;font-size:12px;line-height:1.5;color:#334155}.identity{display:flex;gap:10px;align-items:center;padding:12px;background:#eef7f3;border-radius:14px}.identity ion-icon{font-size:24px;color:#087455}.identity small{display:block;color:#64748b}.notice,.empty,.error{padding:12px;border-radius:12px;margin-top:10px}.template-preview{margin-top:14px;border:1px solid #dce8e3;border-radius:16px;padding:12px}.template-section{margin-top:12px}.template-section h3{font-size:13px;color:#173f60;margin:8px 4px}.template-section ion-item{--padding-start:0;font-size:13px}.template-default{font-size:12px;color:#52687c}.routine-preview{margin-top:16px;padding:14px;border-radius:14px;background:#eef7f3;color:#244c3c}.routine-preview strong{display:block;margin-bottom:6px}.routine-preview p{margin:0;white-space:pre-wrap;line-height:1.45;font-size:13px}.current-orders{display:grid;gap:8px}.order-row{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:11px 12px;border:1px solid #e2e8ee;border-radius:14px;background:#fff}.order-row strong{display:block;color:#173f60;font-size:13px}.order-row span{display:block;color:#64748b;font-size:11px;line-height:1.4;margin-top:3px;white-space:pre-wrap}.notice{background:#eef7f3;color:#245d49}.guidance{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.guidance-chip{border:1px solid #8fb8d8;background:#fff;color:#173f60;border-radius:999px;padding:7px 10px;font-size:12px}.guidance-chip.active{background:#e8f3fb;border-color:#2d78b7}.guidance-reason{width:100%;font-size:12px;color:#42566b}.guidance-caution{width:100%;font-size:11px;background:#fff7e8;color:#7a4a0d;padding:8px 10px;border-radius:10px}.empty{background:#f8fafc;color:#64748b}.error{background:#fff1f0;color:#9d2b25}.center{display:flex;gap:10px;align-items:center}
  `],
})
export class ClinicalOrderPage implements OnInit {
  private route = inject(ActivatedRoute);
  private orderService = inject(MobileOrderService); private identityService = inject(ClinicalIdentityService);
  private toast = inject(ToastController);
  patientId = this.route.snapshot.paramMap.get('patientId') || '';
  appointmentId = this.route.snapshot.queryParamMap.get('appointmentId') || '';
  woundVisitId = this.route.snapshot.queryParamMap.get('woundVisitId') || '';
  episodeId = this.route.snapshot.queryParamMap.get('episodeId') || '';
  loading = true; saving = false; error = '';
  treatmentTemplates: MobileTreatmentProtocolTemplate[] = []; prescribers: MobilePrescriber[] = []; wounds: MobileWoundOption[] = []; orders: MobileClinicalOrderRow[] = [];
  identity: ClinicalIdentitySnapshot | null = null; woundId = ''; woundLabel = '';
  treatmentTemplateId = ''; selectedTreatmentTemplate: MobileTreatmentProtocolTemplate | null = null;
  treatmentSelections: Partial<Record<keyof MobileTreatmentProtocolSections, string[]>> = {};
  routineWoundManagement = 'Wound care per specified treatment protocol/order';
  routineFrequency = 'Daily';
  routineStartDate = new Date().toISOString().slice(0, 10);
  routineDuration = 'Until discontinued';
  routineComments = '';
  readonly woundManagementOptions = [
    'NPWT',
    'Wound care per treatment protocol',
    'Wound care per specified treatment protocol/order',
    'Wound care per provider',
    'Wound prevention',
  ];
  readonly frequencyOptions = [
    'Once',
    'Daily',
    'BID',
    'Every Mon, Thu',
    'Every M, W, F',
    'Every T, Fri',
    'Every Tues, Thurs, Sat',
    'Every 2 days',
    'Every 3 days',
    'Q 21 Days',
    'Per treatment protocol',
  ];
  guidance: MobileAlgorithmGuidance | null = null; selectedWoundType = '';
  receiptMethod: MobileOrderReceiptMethod = 'telephone'; prescriberUid = ''; readBackConfirmed = false;
  readonly documentTextOutline = documentTextOutline; readonly shieldCheckmarkOutline = shieldCheckmarkOutline;

  constructor(){ addIcons({ documentTextOutline, shieldCheckmarkOutline }); }
  get isPrescriber(){ return ['provider','np'].includes(String(this.identity?.role || '').toLowerCase()); }
  get treatmentCategories(){
    return Array.from(new Set(this.treatmentTemplates.map(t => t.category).filter(Boolean))).sort();
  }
  get filteredTreatmentTemplates(){
    const category = this.orderService.treatmentCategoryForWoundType(this.selectedWoundType || '') || this.selectedWoundType;
    return category ? this.treatmentTemplates.filter(t => t.category === category) : [];
  }
  get selectedTypeMatchedGuidance(){ return !!this.selectedWoundType && (this.guidance?.suggestedTypes.includes(this.selectedWoundType) ?? false); }
  get routinePreview(){
    const line = (label: string, values: string[] | undefined) => values?.length ? `${label}: ${values.join(', ')}.` : '';
    return [
      this.routineWoundManagement ? `Wound management: ${this.routineWoundManagement}.` : '',
      line('Special instructions', this.treatmentSelections.specialInstructions),
      line('Cleanse', this.treatmentSelections.cleanse),
      line('Prep / periwound', this.treatmentSelections.prep),
      line('Fill / apply', this.treatmentSelections.fillApply),
      line('Cover', this.treatmentSelections.cover),
      line('Secure', this.treatmentSelections.secureWith),
      this.routineFrequency ? `Frequency: ${this.routineFrequency}.` : '',
      this.routineStartDate ? `Start: ${this.routineStartDate}.` : '',
      this.routineDuration ? `Duration: ${this.routineDuration}.` : '',
      line('Change / PRN', this.treatmentSelections.changePrn),
      this.routineComments.trim() ? `Provider comments: ${this.routineComments.trim()}.` : '',
    ].filter(Boolean).join(' ');
  }

  async ngOnInit(){
    try {
      this.identity = await this.identityService.requireCurrentIdentity();
      [this.treatmentTemplates, this.prescribers, this.wounds] = await Promise.all([
        this.orderService.listPublishedTreatmentProtocols(),
        this.orderService.listPrescribers(),
        this.orderService.listWounds(this.patientId)
      ]);
      await this.refreshOrders();
    } catch(e:any){ this.error = e?.message || 'Clinical ordering workspace could not be loaded.'; }
    finally { this.loading = false; }
  }
  onTreatmentTemplateChanged(){
    this.selectedTreatmentTemplate = this.filteredTreatmentTemplates.find(t => t.id === this.treatmentTemplateId) || null;
    this.treatmentSelections = {};
    if (!this.selectedTreatmentTemplate) return;
    this.routineWoundManagement = this.normalizeTreatmentManagement(
      this.selectedTreatmentTemplate.orderDefaults?.woundManagement
    );
    this.routineFrequency = this.selectedTreatmentTemplate.orderDefaults?.frequency || 'Daily';
    this.routineStartDate = new Date().toISOString().slice(0, 10);
    this.routineDuration = 'Until discontinued';
    this.routineComments = '';
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
    this.treatmentTemplateId = '';
    this.selectedTreatmentTemplate = null;
    this.treatmentSelections = {};
    this.resetRoutine();
    this.selectedWoundType = '';
  }
  chooseWoundType(type: string){
    this.selectedWoundType = type;
    this.treatmentTemplateId = '';
    this.selectedTreatmentTemplate = null;
    this.treatmentSelections = {};
    this.resetRoutine();
  }

  private normalizeTreatmentManagement(value: string | null | undefined): string {
    const normalized = String(value || '').trim();
    if (!normalized || normalized === 'Wound care per specified algorithm/order') {
      return 'Wound care per specified treatment protocol/order';
    }
    if (normalized === 'Wound care per algorithm') {
      return 'Wound care per treatment protocol';
    }
    return normalized;
  }

  private resetRoutine(): void {
    this.routineWoundManagement = 'Wound care per specified treatment protocol/order';
    this.routineFrequency = 'Daily';
    this.routineStartDate = new Date().toISOString().slice(0, 10);
    this.routineDuration = 'Until discontinued';
    this.routineComments = '';
  }

  private async refreshOrders(): Promise<void> {
    this.orders = await this.orderService.listOrders(this.patientId, {
      visitId: this.woundVisitId || null,
      fieldEncounterVisitId: this.woundVisitId || null,
      appointmentId: this.appointmentId || null,
      woundId: this.woundId || null,
      episodeId: this.episodeId || null,
    });
  }

  async save(){
    if(!this.selectedTreatmentTemplate || !this.selectedWoundType || this.saving) return; this.saving = true;
    try {
      await this.orderService.createTreatmentProtocolOrder(this.patientId, {
        treatmentProtocol: this.selectedTreatmentTemplate,
        selectedCategory: this.selectedWoundType,
        woundId: this.woundId || null,
        woundLabel: this.woundLabel || null,
        receiptMethod: this.isPrescriber ? 'direct' : this.receiptMethod,
        prescriberUid: this.prescriberUid || null,
        readBackConfirmed: this.readBackConfirmed,
        guidance: this.guidance,
        selectedTypeMatchedGuidance: this.selectedTypeMatchedGuidance,
        routine: {
          woundManagement: this.routineWoundManagement || null,
          specialInstructions: this.treatmentSelections.specialInstructions || [],
          cleanse: this.treatmentSelections.cleanse || [],
          prep: this.treatmentSelections.prep || [],
          fillApply: this.treatmentSelections.fillApply || [],
          cover: this.treatmentSelections.cover || [],
          secureWith: this.treatmentSelections.secureWith || [],
          frequency: this.routineFrequency || null,
          startDate: this.routineStartDate || null,
          duration: this.routineDuration || null,
          changePrn: this.treatmentSelections.changePrn || [],
          comments: this.routineComments.trim() || null,
        },
        visitLink: {
          visitId: this.woundVisitId || null,
          appointmentId: this.appointmentId || null,
          woundId: this.woundId || null,
          episodeId: this.episodeId || null,
          fieldEncounterVisitId: this.woundVisitId || null,
        },
      });
      await this.refreshOrders();
      const t = await this.toast.create({ message:'Order saved and added to Current Orders', duration:2200, color:'success' }); await t.present();
      this.treatmentTemplateId = '';
      this.selectedTreatmentTemplate = null;
      this.treatmentSelections = {};
      this.resetRoutine();
    } catch(e:any){ const t = await this.toast.create({message:e?.message || 'Order could not be saved', duration:3200, color:'danger'}); await t.present(); }
    finally { this.saving = false; }
  }
}
