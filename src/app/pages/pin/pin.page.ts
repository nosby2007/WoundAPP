import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonInput,
  IonButton,
  IonIcon,
  IonSpinner,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { lockClosedOutline, lockOpenOutline, alertCircleOutline } from 'ionicons/icons';
import { PinService } from 'src/app/services/pin.service';

type Mode = 'loading' | 'create' | 'unlock' | 'error';

/**
 * One screen, two jobs: create the PIN if the account has none, ask for it
 * if it does. Which one is decided by the server, not by anything the app
 * could be talked into believing.
 */
@Component({
  selector: 'app-pin',
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonInput, IonButton, IonIcon, IonSpinner],
  templateUrl: './pin.page.html',
  styleUrls: ['./pin.page.scss'],
})
export class PinPage {
  mode: Mode = 'loading';
  pin = '';
  confirmPin = '';
  busy = false;
  errorMsg: string | null = null;

  constructor(private pinService: PinService, private router: Router) {
    // Ionic standalone does not ship a global icon registry -- each page
    // registers what it renders, the same way patient-assessments does.
    // Without this the icon slot is simply blank.
    addIcons({ lockClosedOutline, lockOpenOutline, alertCircleOutline });
  }

  ionViewWillEnter() {
    this.pin = '';
    this.confirmPin = '';
    void this.load();
  }

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
      await this.router.navigate(['/tabs', 'patients']);
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
    this.mode = 'loading';
    try {
      const status = await this.pinService.status();
      this.mode = status.hasPin ? 'unlock' : 'create';
      if (status.lockedUntilMs) {
        const minutes = Math.ceil((status.lockedUntilMs - Date.now()) / 60000);
        this.errorMsg = `Too many attempts. Try again in ${minutes} minute(s).`;
      }
    } catch (e: any) {
      this.errorMsg = e?.message || 'Could not load the access code status.';
      this.mode = 'error';
    }
  }
}
