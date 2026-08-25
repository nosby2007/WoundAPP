import { Component } from '@angular/core';
import { addIcons } from 'ionicons';
import { peopleOutline, personAddOutline } from 'ionicons/icons';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  standalone: false,
})
export class TabsPage {
  constructor() {
    // Ionic standalone has no global icon registry; the shell registers the
    // two glyphs its tab bar names.
    addIcons({ peopleOutline, personAddOutline });
  }
}
