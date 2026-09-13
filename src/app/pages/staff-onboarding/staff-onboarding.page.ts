import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonContent, IonIcon, IonProgressBar } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  checkmarkCircleOutline, clipboardOutline, documentTextOutline, exitOutline,
  heartOutline, homeOutline, personCircleOutline, pulseOutline,
  shieldCheckmarkOutline, sparklesOutline,
} from 'ionicons/icons';

import { auth } from '../../firebase';
import { ClinicalIdentityService } from '../../services/clinical-identity.service';

interface OnboardingStep {
  icon: string;
  eyebrow: string;
  title: string;
  message: string;
}

@Component({
  selector: 'app-staff-onboarding',
  standalone: true,
  imports: [CommonModule, IonButton, IonContent, IonIcon, IonProgressBar],
  templateUrl: './staff-onboarding.page.html',
  styleUrls: ['./staff-onboarding.page.scss'],
})
export class StaffOnboardingPage implements OnInit, OnDestroy {
  readonly steps: OnboardingStep[] = [
    { icon: 'home-outline', eyebrow: 'Arrive', title: 'Check in at the patient location', message: 'Open the scheduled visit only after you are on site. Confirm the correct patient and visit before clinical documentation starts.' },
    { icon: 'clipboard-outline', eyebrow: 'Assess', title: 'Start the clinical assessment', message: 'Review the patient context, then document what you actually observe. Keep the work tied to the same scheduled encounter.' },
    { icon: 'pulse-outline', eyebrow: 'Risk', title: 'Complete the Braden score', message: 'Capture pressure-injury risk and document interventions that match the patient’s current risk profile.' },
    { icon: 'person-circle-outline', eyebrow: 'Whole patient', title: 'Complete head-to-toe / systemic assessment', message: 'Look beyond the wound. Record relevant skin, circulation, edema, pain, nutrition, mobility, and systemic findings.' },
    { icon: 'document-text-outline', eyebrow: 'Wound work', title: 'Assess, photograph, and document treatment', message: 'Measure the wound, use the rear camera and flash when needed, then record the treatment that was actually performed.' },
    { icon: 'shield-checkmark-outline', eyebrow: 'Close the loop', title: 'Educate, coordinate, and verify', message: 'Document education, required communication, and any orders or follow-up that were actually addressed.' },
    { icon: 'exit-outline', eyebrow: 'Before you leave', title: 'Check out and confirm the visit signature', message: 'Complete checkout at the patient location, make sure the patient or authorized person signs the visit out when required, confirm sync, then leave.' },
  ];

  stepIndex = 0;
  firstName = 'there';
  starting = false;
  private stepTimer: ReturnType<typeof setInterval> | null = null;

  readonly todayLabel = new Intl.DateTimeFormat(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  }).format(new Date());

  constructor(
    private readonly router: Router,
    private readonly identity: ClinicalIdentityService,
  ) {
    addIcons({
      checkmarkCircleOutline, clipboardOutline, documentTextOutline, exitOutline,
      heartOutline, homeOutline, personCircleOutline, pulseOutline,
      shieldCheckmarkOutline, sparklesOutline,
    });
  }

  async ngOnInit(): Promise<void> {
    await this.loadName();
    this.stepTimer = setInterval(() => this.advanceAutomatically(), 2650);
  }

  ngOnDestroy(): void {
    if (this.stepTimer) clearInterval(this.stepTimer);
  }

  get greeting(): string {
    const hour = new Date().getHours();
    return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  }

  get activeStep(): OnboardingStep {
    return this.steps[this.stepIndex];
  }

  get progress(): number {
    return (this.stepIndex + 1) / this.steps.length;
  }

  goToStep(index: number): void {
    if (index < 0 || index >= this.steps.length) return;
    this.stepIndex = index;
    this.restartTimer();
  }

  nextStep(): void {
    if (this.stepIndex < this.steps.length - 1) {
      this.stepIndex += 1;
      this.restartTimer();
    }
  }

  async startDay(): Promise<void> {
    if (this.starting) return;
    this.starting = true;
    if (this.stepTimer) clearInterval(this.stepTimer);
    await this.router.navigateByUrl('/tabs/today', { replaceUrl: true });
  }

  private advanceAutomatically(): void {
    if (this.stepIndex < this.steps.length - 1) this.stepIndex += 1;
    else if (this.stepTimer) {
      clearInterval(this.stepTimer);
      this.stepTimer = null;
    }
  }

  private restartTimer(): void {
    if (this.stepTimer) clearInterval(this.stepTimer);
    this.stepTimer = setInterval(() => this.advanceAutomatically(), 2650);
  }

  private async loadName(): Promise<void> {
    try {
      const identity = await this.identity.currentIdentity();
      if (identity?.displayName) {
        this.firstName = identity.displayName.trim().split(/\s+/)[0];
        return;
      }
    } catch {}

    const displayName = auth.currentUser?.displayName?.trim();
    const email = auth.currentUser?.email?.trim();
    this.firstName = displayName ? displayName.split(/\s+/)[0] : email ? email.split('@')[0] : 'there';
  }
}
