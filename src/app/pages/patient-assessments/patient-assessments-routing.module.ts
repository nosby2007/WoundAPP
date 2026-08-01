import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { PatientAssessmentsPage } from './patient-assessments.page';

const routes: Routes = [
  {
    path: '',
    component: PatientAssessmentsPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PatientAssessmentsPageRoutingModule {}
