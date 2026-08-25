import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { PinService } from 'src/app/SERVICE/pin.service';

type Mode = 'loading' | 'create' | 'unlock' | 'error';

/**
 * One screen, two jobs: create the PIN if the account has none, ask for it
 * if it does. Which one is decided by the server, not by anything the
 * client could be talked into believing.
 */
@Component({
  selector: 'app-pin',
  templateUrl: './pin.component.html',
  styleUrls: ['./pin.component.scss'],
})
export class PinComponent implements OnInit {
  mode: Mode = 'loading';
  pin = '';
  confirmPin = '';
  busy = false;
  errorMsg: string | null = null;

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  constructor(private pinService: PinService, private router: Router) {}

  get canSubmit(): boolean {
    if (this.busy || !/^\d{6}$/.test(this.pin)) return false;
    return this.mode === 'create' ? this.pin === this.confirmPin : true;
  }

  async submit(): Promise<void> {
    if (!this.canSubmit) return;
    this.busy = true;
    this.errorMsg = null;
    try {
      if (this.mode === 'create') {
        await this.pinService.setPin(this.pin);
      } else {
        await this.pinService.verify(this.pin);
      }
      await this.router.navigate(['/home']);
    } catch (e: any) {
      // The server's message carries what the user needs to act on --
      // attempts remaining, or how long the lockout has left.
      this.errorMsg = e?.message || 'That did not work. Please try again.';
      this.pin = '';
      this.confirmPin = '';
    } finally {
      this.busy = false;
    }
  }

  private async load(): Promise<void> {
    try {
      const status = await this.pinService.status();
      this.mode = status.hasPin ? 'unlock' : 'create';
      if (status.lockedUntilMs) {
        const minutes = Math.ceil((status.lockedUntilMs - Date.now()) / 60000);
        this.errorMsg = `Trop de tentatives. Réessayez dans ${minutes} minute(s).`;
      }
    } catch (e: any) {
      this.errorMsg = e?.message || 'Impossible de charger le statut du code.';
      this.mode = 'error';
    }
  }
}
