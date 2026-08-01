import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AssessmentFormPage } from './assessment-form.page';

const routes: Routes = [
  {
    path: '',
    component: AssessmentFormPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AssessmentFormPageRoutingModule {}
