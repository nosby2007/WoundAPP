import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonIcon,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowForwardOutline,
  checkmarkCircleOutline,
  documentTextOutline,
  lockClosedOutline,
  pulseOutline,
  shieldCheckmarkOutline,
  timeOutline,
} from 'ionicons/icons';

type PublicPage = 'home' | 'features' | 'solutions' | 'security' | 'demo';

@Component({
  selector: 'app-public-site',
  standalone: true,
  imports: [CommonModule, RouterModule, IonButton, IonContent, IonIcon],
  template: `
    <ion-content [fullscreen]="true" class="public-shell">
      <header class="site-header">
        <a class="brand" routerLink="/" aria-label="WoundAPP home">
          <span class="brand-mark">W</span>
          <span><strong>WoundAPP</strong><small>Clinical field workspace</small></span>
        </a>

        <nav class="nav" aria-label="Public navigation">
          <a routerLink="/features">Features</a>
          <a routerLink="/solutions">Solutions</a>
          <a routerLink="/security">Security</a>
          <a routerLink="/demo">Demo</a>
        </nav>

        <a class="signin" routerLink="/login">Sign in</a>
      </header>

      <main *ngIf="page === 'home'">
        <section class="hero wrap">
          <div class="hero-copy">
            <span class="eyebrow">MOBILE WOUND-CARE OPERATIONS</span>
            <h1>One clinical workspace from arrival to signed wound-care documentation.</h1>
            <p class="lead">
              WoundAPP brings field visits, EVV, wound assessment, care planning, orders,
              education, progress notes and patient documents into one mobile workflow.
            </p>
            <div class="hero-actions">
              <a class="primary-cta" routerLink="/demo">Request a demo <ion-icon name="arrow-forward-outline"></ion-icon></a>
              <a class="secondary-cta" routerLink="/login">Sign in</a>
            </div>
            <div class="trust-line">
              <span><ion-icon name="checkmark-circle-outline"></ion-icon> Role-based clinical access</span>
              <span><ion-icon name="checkmark-circle-outline"></ion-icon> Tenant-aware patient workflows</span>
              <span><ion-icon name="checkmark-circle-outline"></ion-icon> Audit-ready clinical records</span>
            </div>
          </div>

          <div class="product-card" aria-label="WoundAPP workflow preview">
            <div class="product-top">
              <div><small>ACTIVE VISIT</small><strong>Patient clinical command</strong></div>
              <span class="status">On site</span>
            </div>
            <div class="workflow">
              <div><span>1</span><b>Check-in / EVV</b><small>Arrival, location, visit context</small></div>
              <div><span>2</span><b>Assess</b><small>General, systemic and wound findings</small></div>
              <div><span>3</span><b>Plan & order</b><small>Care plan, treatment orders, education</small></div>
              <div><span>4</span><b>Document</b><small>Progress note and clinical record</small></div>
            </div>
            <div class="metric-row">
              <div><small>WOUNDS</small><strong>3 active</strong></div>
              <div><small>READINESS</small><strong>8 / 9</strong></div>
              <div><small>RECORD</small><strong>Visit-linked</strong></div>
            </div>
          </div>
        </section>

        <section class="section wrap">
          <div class="section-heading">
            <span class="eyebrow dark">BUILT AROUND THE VISIT</span>
            <h2>Clinical workflow without the fragmented handoffs.</h2>
            <p>Each step stays tied to the patient, wound and encounter instead of becoming another disconnected form.</p>
          </div>
          <div class="feature-grid">
            <article>
              <ion-icon name="pulse-outline"></ion-icon>
              <h3>Wound assessment</h3>
              <p>Structured measurements, wound findings, photography and longitudinal wound history.</p>
            </article>
            <article>
              <ion-icon name="time-outline"></ion-icon>
              <h3>EVV & field execution</h3>
              <p>Arrival, departure and visit workflow stay connected to the same clinical encounter.</p>
            </article>
            <article>
              <ion-icon name="document-text-outline"></ion-icon>
              <h3>Clinical documentation</h3>
              <p>Progress notes, care plans, orders, education and visit-specific printable records.</p>
            </article>
            <article>
              <ion-icon name="shield-checkmark-outline"></ion-icon>
              <h3>Controlled access</h3>
              <p>Role-aware workspaces and organization-scoped data access for clinical operations.</p>
            </article>
          </div>
        </section>

        <section class="band">
          <div class="wrap band-grid">
            <div>
              <span class="eyebrow">FROM FIELD TO REVIEW</span>
              <h2>Designed for mobile clinicians and the teams supporting them.</h2>
            </div>
            <div class="steps">
              <span>RN / NP point-of-care workflow</span>
              <span>Facility wound rounds</span>
              <span>Patient documents & supporting evidence</span>
              <span>Clinical record handoff for downstream review</span>
            </div>
          </div>
        </section>

        <section class="cta wrap">
          <div>
            <span class="eyebrow dark">SEE THE WORKFLOW</span>
            <h2>Explore WoundAPP before opening the clinical workspace.</h2>
          </div>
          <div class="hero-actions">
            <a class="primary-cta" routerLink="/features">Explore features</a>
            <a class="secondary-cta" routerLink="/login">Clinical sign in</a>
          </div>
        </section>
      </main>

      <main *ngIf="page !== 'home'" class="inner-main">
        <section class="inner-hero wrap">
          <span class="eyebrow">{{ eyebrow }}</span>
          <h1>{{ title }}</h1>
          <p class="lead">{{ intro }}</p>
          <div class="hero-actions">
            <a class="primary-cta" routerLink="/demo" *ngIf="page !== 'demo'">Request a demo</a>
            <a class="secondary-cta" routerLink="/login">Sign in</a>
          </div>
        </section>

        <section class="section wrap" *ngIf="page === 'features'">
          <div class="feature-grid">
            <article><h3>Patient clinical command</h3><p>A single patient workspace for assessment, planning, orders, education, documentation and visit close-out.</p></article>
            <article><h3>Wound lifecycle</h3><p>Track re-evaluations against the same wound identity instead of creating disconnected records.</p></article>
            <article><h3>Progress notes with context</h3><p>Show approved diagnoses, history, allergies, medications, orders and recent clinical context while preserving clinician authorship.</p></article>
            <article><h3>Patient documents</h3><p>Clinical users can access supporting referrals, authorizations, insurance, lab and discharge documents from the patient workflow.</p></article>
            <article><h3>Visit records</h3><p>Generate visit-linked clinical records for continuity, review and downstream operations.</p></article>
            <article><h3>Wound rounds</h3><p>Mobile workflows for facility-based wound review with explicit scope and clinical-role boundaries.</p></article>
          </div>
        </section>

        <section class="section wrap" *ngIf="page === 'solutions'">
          <div class="feature-grid">
            <article><h3>Home wound-care teams</h3><p>Support mobile nurses and providers moving between patient homes without losing encounter context.</p></article>
            <article><h3>Facility wound rounds</h3><p>Organize assigned patients, wound reviews and documentation during facility-based rounds.</p></article>
            <article><h3>Clinical operations</h3><p>Bridge point-of-care documentation with patient documents, visit history and administrative follow-through.</p></article>
            <article><h3>Multi-tenant delivery</h3><p>Keep organization context explicit so one product can support separate clinical organizations without blending records.</p></article>
          </div>
        </section>

        <section class="section wrap" *ngIf="page === 'security'">
          <div class="security-panel">
            <div><ion-icon name="lock-closed-outline"></ion-icon><h3>Authenticated clinical access</h3><p>Protected routes remain behind the existing sign-in and PIN workflow.</p></div>
            <div><ion-icon name="shield-checkmark-outline"></ion-icon><h3>Role-aware permissions</h3><p>Clinical and operational workspaces use explicit role and route-access policies.</p></div>
            <div><ion-icon name="document-text-outline"></ion-icon><h3>Audit-conscious workflows</h3><p>Clinical records preserve source context, encounter linkage and authored documentation instead of silently fabricating findings.</p></div>
          </div>
          <p class="disclaimer">Security controls shown here describe implemented product architecture. This page does not represent a legal or regulatory certification.</p>
        </section>

        <section class="section wrap" *ngIf="page === 'demo'">
          <div class="demo-card">
            <span class="eyebrow dark">REQUEST A DEMO</span>
            <h2>Walk through the field workflow with your team.</h2>
            <p>See patient selection, EVV, wound assessment, wound history, care planning, orders, progress notes and patient documents in one guided workflow.</p>
            <a class="primary-cta" href="mailto:support@perryhomewoundcare.network?subject=WoundAPP%20Demo%20Request">Email demo request</a>
            <small>No patient information should be included in a demo request email.</small>
          </div>
        </section>
      </main>

      <footer class="footer">
        <div class="wrap">
          <div><strong>WoundAPP</strong><span>Mobile wound-care clinical workspace</span></div>
          <div class="footer-links"><a routerLink="/features">Features</a><a routerLink="/security">Security</a><a routerLink="/login">Sign in</a></div>
        </div>
      </footer>
    </ion-content>
  `,
  styles: [`
    :host{--navy:#102d46;--green:#0b7551;--ink:#10233f;--muted:#607489;--line:#dde7ec;display:block}
    .public-shell{--background:#f7faf9;color:var(--ink)}
    .wrap{width:min(1180px,calc(100% - 32px));margin:0 auto}
    .site-header{height:74px;padding:0 max(16px,calc((100vw - 1180px)/2));display:flex;align-items:center;gap:28px;position:sticky;top:0;z-index:20;background:rgba(247,250,249,.94);backdrop-filter:blur(14px);border-bottom:1px solid rgba(221,231,236,.8)}
    .brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--ink);margin-right:auto}.brand-mark{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:linear-gradient(145deg,var(--green),#163e58);color:#fff;font-weight:900}.brand strong,.brand small{display:block}.brand strong{font-size:16px}.brand small{font-size:10px;color:var(--muted);margin-top:1px}
    .nav{display:flex;gap:24px}.nav a,.signin,.footer a{color:#40566c;text-decoration:none;font-size:13px;font-weight:700}.signin{border:1px solid #cbd9df;border-radius:10px;padding:10px 15px;background:#fff}
    .hero{display:grid;grid-template-columns:1.1fr .9fr;gap:54px;align-items:center;padding:82px 0 72px}.eyebrow{font-size:11px;letter-spacing:.17em;font-weight:900;color:#caefe1}.eyebrow.dark{color:#4b697d}.hero h1,.inner-hero h1{font-size:clamp(42px,5vw,68px);line-height:1.02;letter-spacing:-.045em;margin:12px 0 20px;color:var(--ink);max-width:850px}.lead{font-size:18px;line-height:1.65;color:var(--muted);max-width:720px}.hero-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}.primary-cta,.secondary-cta{min-height:46px;padding:0 18px;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;font-size:14px;font-weight:800}.primary-cta{background:var(--green);color:#fff;box-shadow:0 10px 25px rgba(11,117,81,.18)}.secondary-cta{background:#fff;color:var(--ink);border:1px solid var(--line)}.trust-line{display:flex;gap:16px;flex-wrap:wrap;margin-top:26px;color:#526a7d;font-size:12px}.trust-line span{display:flex;align-items:center;gap:5px}.trust-line ion-icon{color:var(--green)}
    .product-card{background:#fff;border:1px solid var(--line);border-radius:28px;padding:22px;box-shadow:0 24px 65px rgba(22,55,74,.12)}.product-top{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);padding-bottom:15px}.product-top small,.metric-row small{display:block;font-size:9px;letter-spacing:.12em;color:#79909f;font-weight:900}.product-top strong{display:block;margin-top:4px}.status{background:#e4f6ee;color:#08704c;padding:6px 9px;border-radius:999px;font-size:10px;font-weight:800}.workflow{display:grid;gap:9px;padding:18px 0}.workflow div{display:grid;grid-template-columns:34px 1fr;column-gap:10px;align-items:center;background:#f6f9f8;border-radius:15px;padding:11px}.workflow span{grid-row:1/3;width:30px;height:30px;border-radius:10px;background:#e2f2eb;color:var(--green);display:grid;place-items:center;font-weight:900}.workflow b{font-size:12px}.workflow small{color:var(--muted);font-size:10px}.metric-row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.metric-row div{background:#f8fafb;border:1px solid #e8eef1;border-radius:12px;padding:10px}.metric-row strong{display:block;font-size:11px;margin-top:3px}
    .section{padding:76px 0}.section-heading{max-width:720px}.section h2,.band h2,.cta h2,.demo-card h2{font-size:clamp(28px,4vw,46px);letter-spacing:-.035em;line-height:1.08;margin:9px 0 13px}.section-heading p{color:var(--muted);line-height:1.6}.feature-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:34px}.feature-grid article{background:#fff;border:1px solid var(--line);border-radius:20px;padding:22px;min-height:190px}.feature-grid ion-icon{font-size:27px;color:var(--green)}.feature-grid h3{margin:14px 0 8px;font-size:17px}.feature-grid p{color:var(--muted);font-size:13px;line-height:1.6;margin:0}
    .band{background:linear-gradient(145deg,#103148,#0b6d50);color:#fff;padding:70px 0}.band-grid{display:grid;grid-template-columns:1fr 1fr;gap:50px;align-items:start}.band h2{color:#fff;margin-bottom:0}.steps{display:grid;grid-template-columns:1fr 1fr;gap:10px}.steps span{background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.12);padding:15px;border-radius:15px;font-size:12px;font-weight:700}.cta{padding:70px 0;display:flex;justify-content:space-between;align-items:center;gap:30px}
    .inner-main{min-height:calc(100vh - 150px)}.inner-hero{padding:86px 0 26px}.inner-hero .eyebrow{color:#4d7183}.inner-hero h1{max-width:900px}.security-panel{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.security-panel>div,.demo-card{background:#fff;border:1px solid var(--line);border-radius:22px;padding:26px}.security-panel ion-icon{font-size:30px;color:var(--green)}.security-panel p,.demo-card p{color:var(--muted);line-height:1.65}.disclaimer{margin-top:18px;color:#748795;font-size:12px}.demo-card{max-width:720px}.demo-card small{display:block;margin-top:14px;color:#7c8d99}
    .footer{border-top:1px solid var(--line);background:#fff;padding:28px 0}.footer .wrap{display:flex;justify-content:space-between;align-items:center;gap:20px}.footer strong,.footer span{display:block}.footer span{font-size:11px;color:var(--muted);margin-top:3px}.footer-links{display:flex;gap:18px}
    @media(max-width:900px){.nav{display:none}.hero{grid-template-columns:1fr;padding-top:54px}.product-card{max-width:680px}.feature-grid{grid-template-columns:1fr 1fr}.band-grid{grid-template-columns:1fr}.cta{align-items:flex-start;flex-direction:column}.security-panel{grid-template-columns:1fr}.hero h1,.inner-hero h1{font-size:46px}}
    @media(max-width:560px){.site-header{height:66px}.brand small{display:none}.hero{padding:42px 0}.hero h1,.inner-hero h1{font-size:38px}.lead{font-size:16px}.feature-grid,.steps,.metric-row{grid-template-columns:1fr}.section{padding:52px 0}.footer .wrap{align-items:flex-start;flex-direction:column}}
  `],
})
export class PublicSitePage {
  readonly page: PublicPage;
  readonly title: string;
  readonly intro: string;
  readonly eyebrow: string;

  constructor(route: ActivatedRoute) {
    addIcons({
      arrowForwardOutline,
      checkmarkCircleOutline,
      documentTextOutline,
      lockClosedOutline,
      pulseOutline,
      shieldCheckmarkOutline,
      timeOutline,
    });

    this.page = (route.snapshot.data['page'] || 'home') as PublicPage;
    const copy: Record<Exclude<PublicPage, 'home'>, { eyebrow: string; title: string; intro: string }> = {
      features: {
        eyebrow: 'PRODUCT CAPABILITIES',
        title: 'The wound-care workflow, connected from the first touchpoint to the clinical record.',
        intro: 'WoundAPP organizes the point-of-care steps clinicians already perform and keeps them attached to the patient, encounter and wound context.',
      },
      solutions: {
        eyebrow: 'WHO IT IS FOR',
        title: 'A field-first workspace for wound-care teams working across homes and facilities.',
        intro: 'The product is designed around mobile clinical execution rather than a desktop-only charting experience.',
      },
      security: {
        eyebrow: 'SECURITY ARCHITECTURE',
        title: 'Protected clinical workflows with explicit access boundaries.',
        intro: 'WoundAPP keeps public marketing pages separate from the authenticated clinical application and uses existing role, tenant and route controls inside the product.',
      },
      demo: {
        eyebrow: 'PRODUCT WALKTHROUGH',
        title: 'See how WoundAPP moves through a real wound-care visit.',
        intro: 'A guided demo can focus on the field workflow, wound documentation, provider review, patient documents and visit-linked records.',
      },
    };
    const current = this.page === 'home' ? copy.features : copy[this.page];
    this.eyebrow = current.eyebrow;
    this.title = current.title;
    this.intro = current.intro;
  }
}
