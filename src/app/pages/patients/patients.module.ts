import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PatientsPageRoutingModule } from './patients-routing.module';
import { PatientsPage } from './patients.page';


@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    PatientsPageRoutingModule,
    PatientsPage,          // ✅ on importe le standalone
  ],
  // ❌ PAS de declarations ici (sinon NG6008)
})
export class PatientsPageModule {}
