import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { WoundHistoryPageRoutingModule } from './wound-history-routing.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    WoundHistoryPageRoutingModule
  ],
})
export class WoundHistoryPageModule {}
