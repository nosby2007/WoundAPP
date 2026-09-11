import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SessionSecurityService {
  readonly locked = signal(true);
  private lastActivityAt = 0;
  private readonly timeoutMs = 15 * 60 * 1000;

  /**
   * In-memory state is only a privacy/UX control (screen obscuring and
   * re-prompt). It is deliberately not persisted and is NOT a security
   * boundary. Authorization remains server-side.
   */
  unlock(): void {
    this.lastActivityAt = Date.now();
    this.locked.set(false);
  }

  markActivity(): void {
    if (!this.locked()) this.lastActivityAt = Date.now();
  }

  lock(): void {
    this.lastActivityAt = 0;
    this.locked.set(true);
  }

  isFresh(): boolean {
    return !this.locked() && this.lastActivityAt > 0 && Date.now() - this.lastActivityAt <= this.timeoutMs;
  }

  remainingMs(): number {
    if (!this.isFresh()) return 0;
    return Math.max(0, this.timeoutMs - (Date.now() - this.lastActivityAt));
  }
}
