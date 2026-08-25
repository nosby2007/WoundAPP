import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { PatientAssessmentsPageRoutingModule } from './patient-assessments-routing.module';

import { PatientAssessmentsPage } from './patient-assessments.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    PatientAssessmentsPageRoutingModule
  ],
})
export class PatientAssessmentsPageModule {}
