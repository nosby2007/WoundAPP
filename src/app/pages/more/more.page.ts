import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonContent, IonHeader, IonItem, IonLabel, IonList, IonNote, IonTitle, IonToolbar } from '@ionic/angular/standalone';

@Component({
  selector: 'app-more',
  standalone: true,
  imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonButton, IonNote],
  template: `
    <ion-header><ion-toolbar><ion-title>More</ion-title></ion-toolbar></ion-header>
    <ion-content class="ion-padding">
      <div class="hero">
        <p class="eyebrow">FIELD TOOLS</p>
        <h1>More</h1>
        <p>Additional mobile workflows and account actions.</p>
      </div>

      <ion-list lines="full">
        <ion-item button detail="true" (click)="newPatient()">
          <ion-label><strong>New patient</strong><p>Create a patient record.</p></ion-label>
        </ion-item>
      </ion-list>
      <ion-note>More field tools can be added here without overloading the main tab bar.</ion-note>
    </ion-content>
  `,
  styles: [`
    .hero{background:linear-gradient(135deg,#0f6b46,#173b5b);color:white;border-radius:24px;padding:20px;margin-bottom:18px}.hero h1{margin:2px 0 6px;font-size:30px}.hero p{margin:0;opacity:.9}.eyebrow{font-size:11px;letter-spacing:.12em;font-weight:700}ion-list{border-radius:18px;overflow:hidden;margin-bottom:14px}
  `]
})
export class MorePage {
  constructor(private router: Router) {}
  newPatient(): void { void this.router.navigate(['/tabs/add-patient']); }
}
