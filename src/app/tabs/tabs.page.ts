import { Component } from '@angular/core';
import { addIcons } from 'ionicons';
import {
  calendarOutline,
  callOutline,
  chatbubblesOutline,
  chevronBackOutline,
  createOutline,
  ellipsisHorizontalCircleOutline,
  folderOpenOutline,
  navigateOutline,
  peopleOutline,
  personAddOutline,
  sendOutline,
} from 'ionicons/icons';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  standalone: false,
})
export class TabsPage {
  constructor() {
    // Ionic standalone does not provide a global icon registry automatically.
    // Keep every icon referenced by the persistent tab shell and the Today /
    // Chat workspaces registered before those routes render. Otherwise IonIcon
    // tries to resolve an unregistered icon URL at runtime and can throw
    // "Failed to construct 'URL': Invalid base URL" in the hosted PWA.
    addIcons({
      calendarOutline,
      callOutline,
      chatbubblesOutline,
      chevronBackOutline,
      createOutline,
      ellipsisHorizontalCircleOutline,
      folderOpenOutline,
      navigateOutline,
      peopleOutline,
      personAddOutline,
      sendOutline,
    });
  }
}
