import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SessionSecurityService {
  private readonly key = 'woundapp.lastClinicalActivity';
  private readonly timeoutMs = 15 * 60 * 1000;

  markActivity(): void {
    sessionStorage.setItem(this.key, String(Date.now()));
  }

  isFresh(): boolean {
    const raw = sessionStorage.getItem(this.key);
    if (!raw) return false;
    const last = Number(raw);
    return Number.isFinite(last) && Date.now() - last <= this.timeoutMs;
  }

  clear(): void {
    sessionStorage.removeItem(this.key);
  }

  remainingMs(): number {
    const raw = Number(sessionStorage.getItem(this.key) || 0);
    return Math.max(0, this.timeoutMs - (Date.now() - raw));
  }
}
