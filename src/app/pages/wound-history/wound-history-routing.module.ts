import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { WoundHistoryPage } from './wound-history.page';

const routes: Routes = [
  {
    path: '',
    component: WoundHistoryPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class WoundHistoryPageRoutingModule {}
