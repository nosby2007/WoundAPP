import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PatientListComponent } from './COMPONENT/patient-list/patient-list.component';
import { AddPatientComponent } from './COMPONENT/add-patient/add-patient.component';
import { AddAppointmentComponent } from './COMPONENT/add-appointment/add-appointment.component';
import { AppointmentListComponent } from './COMPONENT/appointment-list/appointment-list.component';
import { PatienDetailsComponent } from './COMPONENT/patien-details/patien-details.component';
import { LoginComponent } from './Authentification/login/login.component';
import { AuthGuardGuard } from './SERVICE/auth-guard.guard';
import { PinGuard } from './SERVICE/pin.guard';
import { PinComponent } from './Authentification/pin/pin.component';
import { HomeComponent } from './COMPONENT/home/home.component';
import { ClinicalDashboardComponent } from './components/clinical-dashboard/clinical-dashboard.component';
import { AdminDashboardComponent } from './components/admin-dashboard/admin-dashboard.component';
import { POCComponent } from './components/poc/poc.component';
import { EMARComponent } from './components/e-mar/e-mar.component';
import { AllLinksComponent } from './components/all-links/all-links.component';
import { AutresComponent } from './components/autres/autres.component';
import { PatientListAdComponent } from './Administrator/patient-list-ad/patient-list-ad.component';
import { NouveauProComponent } from './Administrator/nouveau-pro/nouveau-pro.component';
import { TableauBordComptComponent } from './Administrator/tableau-bord-compt/tableau-bord-compt.component';
import { UDAComptComponent } from './Administrator/udacompt/udacompt.component';
import { RapportComponent } from './Administrator/rapport/rapport.component';
import { SuivitHospiComponent } from './CLINICAL/suivit-hospi/suivit-hospi.component';
import { SystemDAtaMedComponent } from './CLINICAL/system-data-med/system-data-med.component';
import { CommunicationComponent } from './CLINICAL/communication/communication.component';
import { OrdersComponent } from './CLINICAL/orders/orders.component';
import { LabResultComponent } from './CLINICAL/lab-result/lab-result.component';
import { ManagRiskComponent } from './CLINICAL/manag-risk/manag-risk.component';
import { PoidsSignesVComponent } from './CLINICAL/poids-signes-v/poids-signes-v.component';
import { ControlInfectionsComponent } from './CLINICAL/control-infections/control-infections.component';
import { PatientClinicalComponent } from './CLINICAL/patient-clinical/patient-clinical.component';
import { TherapyComponent } from './CLINICAL/therapy/therapy.component';
import { VisitMedicalComponent } from './CLINICAL/visit-medical/visit-medical.component';
import { PoidsComponent } from './CLINICAL/poids/poids.component';
import { VaccinationComponent } from './CLINICAL/vaccination/vaccination.component';
import { GlucoseComponent } from './CLINICAL/glucose/glucose.component';
import { RespirationComponent } from './CLINICAL/respiration/respiration.component';
import { SpO2Component } from './CLINICAL/sp-o2/sp-o2.component';
import { DouleurComponent } from './CLINICAL/douleur/douleur.component';
import { TensionComponent } from './CLINICAL/tension/tension.component';
import { PoolsComponent } from './CLINICAL/pools/pools.component';
import { RapportQualiteComponent } from './RAPPORT/rapport-qualite/rapport-qualite.component';
import { RapportCliniqueComponent } from './RAPPORT/rapport-clinique/rapport-clinique.component';
import { RapportFinancierComponent } from './RAPPORT/rapport-financier/rapport-financier.component';

const routes: Routes = [
  {path: '', redirectTo:'login', pathMatch:'full'},
  {path:'login', component:LoginComponent,},
  // Signed in but not yet unlocked: reachable with AuthGuard alone, or the
  // PIN screen would guard itself and nobody could ever reach it.
  {path:'pin', component:PinComponent, canActivate:[AuthGuardGuard]},
  {path:'home', component:HomeComponent, canActivate:[AuthGuardGuard, PinGuard]},
  {path:'poc', component:POCComponent, canActivate:[AuthGuardGuard, PinGuard]},
  {path:'emar', component:EMARComponent, canActivate:[AuthGuardGuard, PinGuard]},
  {path:'allLink', component:AllLinksComponent, canActivate:[AuthGuardGuard, PinGuard]},
  {path:'autres', component:AutresComponent, canActivate:[AuthGuardGuard, PinGuard]},
  {path:'patientAd', component:PatientListAdComponent, canActivate:[AuthGuardGuard, PinGuard]},
  {path:'medicaux', component:NouveauProComponent, canActivate:[AuthGuardGuard, PinGuard]},
  {path:'finance', component:TableauBordComptComponent, canActivate:[AuthGuardGuard, PinGuard]},
  {path:'udaComp', component:UDAComptComponent, canActivate:[AuthGuardGuard, PinGuard]},
  {path:'rapport', component:RapportComponent, canActivate:[AuthGuardGuard, PinGuard]},
  {path:'dashbordCli', component:ClinicalDashboardComponent, canActivate:[AuthGuardGuard, PinGuard]},
  {path:'suiviHos', component:SuivitHospiComponent, canActivate:[AuthGuardGuard, PinGuard]},
  {path:'mds', component:SystemDAtaMedComponent, canActivate:[AuthGuardGuard, PinGuard]},
  {path:'com', component:CommunicationComponent, canActivate:[AuthGuardGuard, PinGuard]},
  {path:'prescription', component:OrdersComponent, canActivate:[AuthGuardGuard, PinGuard]},
  {path:'labo', component:LabResultComponent, canActivate:[AuthGuardGuard, PinGuard]},
  {path:'risques', component:ManagRiskComponent, canActivate:[AuthGuardGuard, PinGuard]},
  {path:'signes', component:PoidsSignesVComponent, canActivate:[AuthGuardGuard, PinGuard]},
  {path:'uda', component:UDAComptComponent, canActivate:[AuthGuardGuard, PinGuard]},
  {path:'infection', component:ControlInfectionsComponent, canActivate:[AuthGuardGuard, PinGuard]},
  {path:'patientCli', component:PatientClinicalComponent, canActivate:[AuthGuardGuard, PinGuard]},
  {path:'tharapy', component:TherapyComponent, canActivate:[AuthGuardGuard, PinGuard]},
  {path:'VisiteMed', component:VisitMedicalComponent, canActivate:[AuthGuardGuard, PinGuard]},
  {path:'poids', component:PoidsComponent, canActivate:[AuthGuardGuard, PinGuard]},
  {path:'vaccination', component:VaccinationComponent, canActivate:[AuthGuardGuard, PinGuard]},
  {path:'glucose', component:GlucoseComponent, canActivate:[AuthGuardGuard, PinGuard]},
  {path:'respiration', component:RespirationComponent, canActivate:[AuthGuardGuard, PinGuard]},
  {path:'saturation', component:SpO2Component, canActivate:[AuthGuardGuard, PinGuard]},
  {path:'douleur', component:DouleurComponent, canActivate:[AuthGuardGuard, PinGuard]},
  {path:'tension', component:TensionComponent, canActivate:[AuthGuardGuard, PinGuard]},
  {path:'pools', component:PoolsComponent, canActivate:[AuthGuardGuard, PinGuard]},
  {path:'rfinance', component:RapportFinancierComponent, canActivate:[AuthGuardGuard, PinGuard]},
  {path:'rclinique', component:RapportCliniqueComponent, canActivate:[AuthGuardGuard, PinGuard]},
  {path:'rqualite', component:RapportQualiteComponent, canActivate:[AuthGuardGuard, PinGuard]},
  { path: 'admin-dashboard', component: AdminDashboardComponent },
  { path: 'clinical-dashboard', component: ClinicalDashboardComponent },
  {path: "patientList", component:PatientListComponent, canActivate:[AuthGuardGuard, PinGuard]},
  {path: "addPatient", component:AddPatientComponent, canActivate:[AuthGuardGuard, PinGuard]},
  {path: "addAppointment", component:AddAppointmentComponent, canActivate:[AuthGuardGuard, PinGuard]},
  {path: "appointmentList", component:AppointmentListComponent, canActivate:[AuthGuardGuard, PinGuard]},
  {path: "PatientList/:id", component:PatienDetailsComponent, canActivate:[AuthGuardGuard, PinGuard]},
  
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
