import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonSpinner,
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  lockClosedOutline,
  mailOutline,
} from 'ionicons/icons';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { PinService } from '../../services/pin.service';
import { auth, authStateReady } from '../../firebase';

@Component({
  selector: 'app-login',
  
  standalone: true,                     // ✅ on assume standalone
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    // Ionic standalone resolves ion-* through these component classes.
    // IonicModule (the NgModule API) sat here instead, which registers
    // nothing for a standalone component: the tags fell through as
    // unknown elements and the page rendered as bare HTML.
    IonButton,
    IonContent,
    IonIcon,
    IonInput,
    IonItem,
    IonSpinner,
  ],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {
  loading = false;
  errorMsg = '';
  showSplash = true;
  private splashTimer: ReturnType<typeof setTimeout> | null = null;

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private pin: PinService
  ) {
    addIcons({
      arrowBackOutline,
      lockClosedOutline,
      mailOutline,
    });
  }

  async ngOnInit(): Promise<void> {
    const reduceMotion = typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      this.showSplash = false;
    } else {
      this.splashTimer = setTimeout(() => {
        this.showSplash = false;
        this.splashTimer = null;
      }, 1250);
    }

    await authStateReady;
    if (!auth.currentUser) return;

    const unlocked = await this.pin.hasPassedThisSession().catch(() => false);
    await this.router.navigateByUrl(unlocked ? '/tabs/today' : '/pin', {
      replaceUrl: true,
    });
  }

  ngOnDestroy(): void {
    if (this.splashTimer) clearTimeout(this.splashTimer);
  }

  async submit() {
    if (this.form.invalid) return;
    const { email, password } = this.form.value;

    this.loading = true;
    this.errorMsg = '';

    try {
      await this.auth.login(email!, password!);
      await this.router.navigateByUrl('/pin', { replaceUrl: true });

    } catch (err: any) {
      console.error(err);
      this.errorMsg = err?.message || 'Login failed';
    } finally {
      this.loading = false;
    }
  }
}