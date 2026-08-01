import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { PatientAssessmentsPageRoutingModule } from './patient-assessments-routing.module';

import { PatientAssessmentsPage } from './patient-assessments.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    PatientAssessmentsPageRoutingModule
  ],
})
export class PatientAssessmentsPageModule {}
