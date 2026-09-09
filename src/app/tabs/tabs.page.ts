import { Component } from '@angular/core';
import {
  calendarOutline,
  chatbubblesOutline,
  createOutline,
  ellipsisHorizontalCircleOutline,
  peopleOutline,
} from 'ionicons/icons';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  standalone: false,
})
export class TabsPage {
  readonly peopleOutline = peopleOutline;
  readonly calendarOutline = calendarOutline;
  readonly createOutline = createOutline;
  readonly chatbubblesOutline = chatbubblesOutline;
  readonly ellipsisHorizontalCircleOutline = ellipsisHorizontalCircleOutline;
}
