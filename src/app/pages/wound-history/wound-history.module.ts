import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { WoundHistoryPageRoutingModule } from './wound-history-routing.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    WoundHistoryPageRoutingModule
  ],
})
export class WoundHistoryPageModule {}
