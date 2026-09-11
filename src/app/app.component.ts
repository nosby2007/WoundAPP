import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { auth } from './firebase';
import { NetworkStatusService } from './services/network-status.service';
import { SessionSecurityService } from './services/session-security.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit, OnDestroy {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly activityHandler = () => this.onActivity();
  private readonly visibilityHandler = () => {
    if (document.visibilityState === 'hidden') this.lockImmediately('background');
    else this.lockImmediately('resume');
  };
  private readonly pageHideHandler = () => this.lockImmediately('background');
  private readonly pageShowHandler = () => this.lockImmediately('resume');

  constructor(
    public readonly network: NetworkStatusService,
    public readonly session: SessionSecurityService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    for (const event of ['pointerdown', 'keydown', 'touchstart']) {
      window.addEventListener(event, this.activityHandler, { passive: true });
    }
    document.addEventListener('visibilitychange', this.visibilityHandler);
    window.addEventListener('pagehide', this.pageHideHandler);
    window.addEventListener('pageshow', this.pageShowHandler);
    this.timer = setInterval(() => this.enforceTimeout(), 15_000);
  }

  ngOnDestroy(): void {
    for (const event of ['pointerdown', 'keydown', 'touchstart']) {
      window.removeEventListener(event, this.activityHandler);
    }
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    window.removeEventListener('pagehide', this.pageHideHandler);
    window.removeEventListener('pageshow', this.pageShowHandler);
    if (this.timer) clearInterval(this.timer);
  }

  isPhiRoute(): boolean {
    const url = this.router.url.split('?')[0];
    return !!auth.currentUser && url !== '/login' && url !== '/pin' && url !== '/';
  }

  private onActivity(): void {
    if (!this.isPhiRoute()) return;
    if (!this.session.isFresh()) {
      this.lockImmediately('inactivity');
      return;
    }
    this.session.markActivity();
  }

  private enforceTimeout(): void {
    if (this.isPhiRoute() && !this.session.isFresh()) {
      this.lockImmediately('inactivity');
    }
  }

  private lockImmediately(reason: 'background' | 'resume' | 'inactivity'): void {
    if (!this.isPhiRoute()) return;
    this.session.lock();
    // The overlay is raised synchronously by session.lock() before navigation,
    // preventing PHI from remaining visible in the app switcher or while the
    // router resolves the PIN page.
    void this.router.navigate(['/pin'], { replaceUrl: true, queryParams: { reason } });
  }
}
