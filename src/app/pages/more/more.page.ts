import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonBadge, IonButton, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonNote, IonSpinner, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { businessOutline, calendarOutline, chevronForwardOutline, cloudDoneOutline, cloudOfflineOutline, logOutOutline, personAddOutline, shieldCheckmarkOutline, sparklesOutline } from 'ionicons/icons';
import { AuthService } from '../../services/auth.service';
import { TenantService } from '../../services/tenant.service';
import { ClinicalIdentityService } from '../../services/clinical-identity.service';

@Component({
  selector: 'app-more',
  standalone: true,
  imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonButton, IonNote, IonIcon, IonBadge, IonSpinner],
  template: `
    <ion-header class="ion-no-border"><ion-toolbar><ion-title>More</ion-title></ion-toolbar></ion-header>
    <ion-content>
      <div class="page">
        <section class="profile-card">
          <div class="identity"><div class="avatar">{{ initials }}</div><div><p class="eyebrow">CLINICAL ACCOUNT</p><h1>{{ displayName }}</h1><p>{{ credentialsLine || email }}</p></div></div>
          <div class="chips">
            <ion-badge color="light">{{ roleLabel }}</ion-badge>
            <ion-badge [color]="identityReady ? 'success' : 'danger'">{{ identityReady ? 'Clinical identity verified' : 'Identity incomplete' }}</ion-badge>
            <ion-badge [color]="online ? 'success' : 'warning'">{{ online ? 'Online' : 'Offline' }}</ion-badge>
          </div>
          <div class="org"><span>Organization</span><strong>{{ orgId || 'Not assigned' }}</strong></div>
          <div class="identity-warning" *ngIf="!identityReady">
            <strong>Clinical documentation is not signature-ready.</strong>
            <span>{{ identityProblem || 'Complete the staff profile in JADE-SHOP before creating signed clinical documentation.' }}</span>
          </div>
        </section>

        <section class="section">
          <p class="eyebrow dark">CLINICAL WORKSPACE</p>
          <ion-list lines="none" class="menu">
            <ion-item button detail="false" (click)="mySchedule()"><div class="menu-icon"><ion-icon [icon]="calendarOutline"></ion-icon></div><ion-label><strong>My Schedule</strong><p>Today, upcoming visits and self-planning for your own clinical workload.</p></ion-label><ion-icon slot="end" [icon]="chevronForwardOutline"></ion-icon></ion-item>
            <ion-item button detail="false" (click)="woundRounds()"><div class="menu-icon featured"><ion-icon [icon]="businessOutline"></ion-icon></div><ion-label><strong>Wound Rounds</strong><p>iPad-ready facility rounds, patient queue, wound assessments and QA progress.</p></ion-label><ion-badge color="success">New</ion-badge><ion-icon slot="end" [icon]="chevronForwardOutline"></ion-icon></ion-item>
            <ion-item button detail="false" (click)="today()"><div class="menu-icon"><ion-icon [icon]="sparklesOutline"></ion-icon></div><ion-label><strong>Today Command</strong><p>Visits, field tasks and point-of-care execution for today.</p></ion-label><ion-icon slot="end" [icon]="chevronForwardOutline"></ion-icon></ion-item>
            <ion-item button detail="false" (click)="newPatient()"><div class="menu-icon"><ion-icon [icon]="personAddOutline"></ion-icon></div><ion-label><strong>New patient</strong><p>Create a patient record when your role permits it.</p></ion-label><ion-icon slot="end" [icon]="chevronForwardOutline"></ion-icon></ion-item>
          </ion-list>
        </section>

        <section class="section">
          <p class="eyebrow dark">SECURITY & DEVICE</p>
          <ion-list lines="none" class="menu">
            <ion-item detail="false"><div class="menu-icon"><ion-icon [icon]="shieldCheckmarkOutline"></ion-icon></div><ion-label><strong>Protected session</strong><p>Firebase authentication + mobile PIN access.</p></ion-label><ion-badge color="success">Active</ion-badge></ion-item>
            <ion-item detail="false"><div class="menu-icon"><ion-icon [icon]="online ? cloudDoneOutline : cloudOfflineOutline"></ion-icon></div><ion-label><strong>Network</strong><p>{{ online ? 'Connected. Live updates available.' : 'Offline. Avoid closing the app until connectivity returns.' }}</p></ion-label></ion-item>
          </ion-list>
        </section>

        <div class="signout-card">
          <div><strong>End secure session</strong><p>Use this before handing a shared field device to another clinician.</p></div>
          <ion-button color="danger" fill="outline" [disabled]="signingOut" (click)="signOut()"><ion-spinner *ngIf="signingOut" name="crescent"></ion-spinner><ion-icon *ngIf="!signingOut" slot="start" [icon]="logOutOutline"></ion-icon><span *ngIf="!signingOut">Sign out</span></ion-button>
        </div>
        <ion-note class="footnote">WoundApp Field · Secure mobile clinical workspace</ion-note>
      </div>
    </ion-content>
  `,
  styles: [`
    :host{--ink:#10233f;--muted:#667b8e;--green:#0b7551}ion-toolbar{--background:#fff;--color:var(--ink)}.page{background:#f4f7fa;min-height:100%;padding:16px 16px 36px}.profile-card{background:radial-gradient(circle at 88% 8%,rgba(255,255,255,.15),transparent 25%),linear-gradient(145deg,#173d5c,#0b7251);color:#fff;border-radius:28px;padding:22px;box-shadow:0 18px 42px rgba(18,58,78,.19)}.identity{display:flex;gap:14px;align-items:center}.avatar{width:58px;height:58px;border-radius:20px;background:rgba(255,255,255,.14);display:grid;place-items:center;font-size:20px;font-weight:800;letter-spacing:.03em}.profile-card h1{font-size:23px;margin:2px 0 4px}.profile-card p{margin:0;opacity:.78;font-size:12px}.eyebrow{font-size:10px;letter-spacing:.16em;font-weight:800;margin:0 0 5px}.eyebrow.dark{color:#587188;margin:0 4px 9px}.chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}.org{margin-top:14px;background:rgba(255,255,255,.09);border-radius:15px;padding:11px}.org span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.1em;opacity:.65}.org strong{font-size:13px}.identity-warning{display:grid;gap:4px;margin-top:12px;padding:11px 12px;border-radius:15px;background:rgba(90,18,18,.26);border:1px solid rgba(255,255,255,.16)}.identity-warning strong{font-size:12px}.identity-warning span{font-size:10px;opacity:.82}.section{margin-top:25px}.menu{border-radius:22px;overflow:hidden;background:#fff;box-shadow:0 7px 24px rgba(30,55,75,.06)}.menu ion-item{--background:#fff;--padding-start:14px;--inner-padding-end:14px;min-height:78px}.menu-icon{width:42px;height:42px;border-radius:15px;background:#edf6f2;color:var(--green);display:grid;place-items:center;margin-right:12px}.menu-icon.featured{background:linear-gradient(145deg,#e5f6ee,#e8f0fb);color:#0c6f61}.menu-icon ion-icon{font-size:22px}.menu strong{color:var(--ink)}.menu p{margin:3px 0 0;color:var(--muted);font-size:11px;white-space:normal}.menu ion-icon[slot=end]{color:#9aabb9}.signout-card{background:#fff;border:1px solid #f0dede;border-radius:22px;margin-top:25px;padding:16px;display:flex;align-items:center;justify-content:space-between;gap:14px}.signout-card strong{color:var(--ink)}.signout-card p{margin:3px 0 0;color:var(--muted);font-size:11px;max-width:210px}.footnote{display:block;text-align:center;margin-top:18px;font-size:10px}
  `],
})
export class MorePage implements OnInit {
  readonly businessOutline = businessOutline;
  readonly calendarOutline = calendarOutline;
  readonly chevronForwardOutline = chevronForwardOutline;
  readonly cloudDoneOutline = cloudDoneOutline;
  readonly cloudOfflineOutline = cloudOfflineOutline;
  readonly logOutOutline = logOutOutline;
  readonly personAddOutline = personAddOutline;
  readonly shieldCheckmarkOutline = shieldCheckmarkOutline;
  readonly sparklesOutline = sparklesOutline;

  displayName = 'Clinical profile required';
  email = '';
  credentialsLine = '';
  roleLabel = 'Staff';
  orgId: string | null = null;
  identityReady = false;
  identityProblem = '';
  online = navigator.onLine;
  signingOut = false;

  constructor(
    private router: Router,
    private auth: AuthService,
    private tenant: TenantService,
    private clinicalIdentity: ClinicalIdentityService,
  ) {}

  get initials(): string { return this.displayName.split(/\s+/).filter(Boolean).slice(0,2).map(part => part[0]?.toUpperCase()).join('') || 'CL'; }

  async ngOnInit(): Promise<void> {
    const user = this.auth.currentUser;
    this.email = user?.email || '';
    this.orgId = await this.tenant.currentOrgId();

    const readiness = await this.clinicalIdentity.currentReadiness();
    this.identityReady = readiness.ready;
    this.identityProblem = readiness.missing.length ? `Missing: ${readiness.missing.join(', ')}.` : '';
    if (readiness.identity) {
      this.displayName = readiness.identity.displayName;
      this.credentialsLine = [readiness.identity.credentials, readiness.identity.npi ? `NPI ${readiness.identity.npi}` : null].filter(Boolean).join(' · ');
      this.roleLabel = (readiness.identity.role || 'staff').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
  }

  @HostListener('window:online') onOnline(): void { this.online = true; }
  @HostListener('window:offline') onOffline(): void { this.online = false; }

  today(): void { void this.router.navigate(['/tabs/today']); }
  mySchedule(): void { void this.router.navigate(['/tabs/my-schedule']); }
  woundRounds(): void { void this.router.navigate(['/tabs/wound-rounds']); }
  newPatient(): void { void this.router.navigate(['/tabs/add-patient']); }

  async signOut(): Promise<void> {
    if (this.signingOut) return;
    this.signingOut = true;
    try {
      await this.auth.logout();
      await this.router.navigateByUrl('/login', { replaceUrl: true });
    } finally { this.signingOut = false; }
  }
}
