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

  constructor(
    public readonly network: NetworkStatusService,
    private readonly session: SessionSecurityService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    for (const event of ['pointerdown', 'keydown', 'touchstart']) {
      window.addEventListener(event, this.activityHandler, { passive: true });
    }
    this.timer = setInterval(() => this.enforceTimeout(), 30_000);
  }

  ngOnDestroy(): void {
    for (const event of ['pointerdown', 'keydown', 'touchstart']) {
      window.removeEventListener(event, this.activityHandler);
    }
    if (this.timer) clearInterval(this.timer);
  }

  private onActivity(): void {
    if (!auth.currentUser || !this.router.url.startsWith('/tabs')) return;
    if (!this.session.isFresh()) {
      void this.router.navigate(['/pin'], { queryParams: { reason: 'inactivity' } });
      return;
    }
    this.session.markActivity();
  }

  private enforceTimeout(): void {
    if (auth.currentUser && this.router.url.startsWith('/tabs') && !this.session.isFresh()) {
      void this.router.navigate(['/pin'], { queryParams: { reason: 'inactivity' } });
    }
  }
}
