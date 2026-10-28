import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonBadge,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { callOutline, chevronForwardOutline } from 'ionicons/icons';
import { HOME_CARE_EVENT_CLASSES, HomeCareEventClass, HomeCareEventClassDefinition } from '../../shared/home-care-event';

@Component({
  selector: 'app-event-portal',
  standalone: true,
  imports: [
    CommonModule,
    IonBackButton,
    IonBadge,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './event-portal.page.html',
  styleUrls: ['./event-portal.page.scss'],
})
export class EventPortalPage {
  private readonly router = inject(Router);
  readonly eventClasses = HOME_CARE_EVENT_CLASSES;
  readonly callOutline = callOutline;
  readonly chevronForwardOutline = chevronForwardOutline;

  start(eventClass: HomeCareEventClass): void {
    void this.router.navigate(['/tabs/event-portal/report', eventClass]);
  }

  examples(eventClass: HomeCareEventClassDefinition): string {
    return eventClass.options.slice(0, 4).map(option => option.label).join(' · ');
  }
}
