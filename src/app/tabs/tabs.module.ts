import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Standalone Ionic components, matching the rest of the app. IonicModule from
// '@ionic/angular' used to sit here and registered the competing NgModule build
// of the same custom elements.
import {
  IonIcon,
  IonLabel,
  IonTabBar,
  IonTabButton,
  IonTabs,
} from '@ionic/angular/standalone';

import { TabsPageRoutingModule } from './tabs-routing.module';

import { TabsPage } from './tabs.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonIcon,
    IonLabel,
    IonTabBar,
    IonTabButton,
    IonTabs,
    TabsPageRoutingModule,
  ],
  declarations: [TabsPage],
})
export class TabsPageModule {}
