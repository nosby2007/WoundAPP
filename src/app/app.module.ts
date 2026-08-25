import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

import { HttpClientModule } from '@angular/common/http';

import { AngularFireModule } from '@angular/fire/compat';
import { PinComponent } from './Authentification/pin/pin.component';
import { AngularFirestoreModule } from '@angular/fire/compat/firestore';
import { environment } from 'src/environments/environment';
import { AngularFireAuthModule } from '@angular/fire/compat/auth';
import { AngularFireFunctionsModule, REGION } from '@angular/fire/compat/functions';

import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import {MatCard, MatCardModule} from '@angular/material/card';
import {MAT_FORM_FIELD_DEFAULT_OPTIONS, MatFormFieldModule} from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {MatStepperModule} from '@angular/material/stepper';
import { FormBuilder, FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { PatientListComponent } from './COMPONENT/patient-list/patient-list.component';
import { PatienDetailsComponent } from './COMPONENT/patien-details/patien-details.component';
import { AppointmentListComponent } from './COMPONENT/appointment-list/appointment-list.component';
import { MatTableModule} from '@angular/material/table';
import {  MatPaginatorModule } from '@angular/material/paginator';
import {MatIconModule} from '@angular/material/icon';
import { CommonModule, DatePipe } from '@angular/common';
import { AddAppointmentComponent } from './COMPONENT/add-appointment/add-appointment.component';
import { AddPatientComponent } from './COMPONENT/add-patient/add-patient.component';
import { LoginComponent } from './Authentification/login/login.component';
import { NavComponent } from './SHAREPAGES/nav/nav.component';
import { HomeComponent } from './COMPONENT/home/home.component';
import { AdminDashboardComponent } from './components/admin-dashboard/admin-dashboard.component';
import { ClinicalDashboardComponent } from './components/clinical-dashboard/clinical-dashboard.component';
import { POCComponent } from './components/poc/poc.component';
import { EMARComponent } from './components/e-mar/e-mar.component';
import { AllLinksComponent } from './components/all-links/all-links.component';
import { AutresComponent } from './components/autres/autres.component';
import { PatientListAdComponent } from './Administrator/patient-list-ad/patient-list-ad.component';
import { NouveauProComponent } from './Administrator/nouveau-pro/nouveau-pro.component';
import { TableauBordComptComponent } from './Administrator/tableau-bord-compt/tableau-bord-compt.component';
import { UDAComptComponent } from './Administrator/udacompt/udacompt.component';
import { RapportComponent } from './Administrator/rapport/rapport.component';
import { PatientClinicalComponent } from './CLINICAL/patient-clinical/patient-clinical.component';
import { SuivitHospiComponent } from './CLINICAL/suivit-hospi/suivit-hospi.component';
import { SystemDAtaMedComponent } from './CLINICAL/system-data-med/system-data-med.component';
import { CommunicationComponent } from './CLINICAL/communication/communication.component';
import { OrdersComponent } from './CLINICAL/orders/orders.component';
import { LabResultComponent } from './CLINICAL/lab-result/lab-result.component';
import { ManagRiskComponent } from './CLINICAL/manag-risk/manag-risk.component';
import { PoidsSignesVComponent } from './CLINICAL/poids-signes-v/poids-signes-v.component';
import { UDAComponent } from './CLINICAL/uda/uda.component';
import { ControlInfectionsComponent } from './CLINICAL/control-infections/control-infections.component';
import { TherapyComponent } from './CLINICAL/therapy/therapy.component';
import { VisitMedicalComponent } from './CLINICAL/visit-medical/visit-medical.component';
import { VaccinationComponent } from './CLINICAL/vaccination/vaccination.component';
import { PoidsComponent } from './CLINICAL/poids/poids.component';
import { RespirationComponent } from './CLINICAL/respiration/respiration.component';
import { GlucoseComponent } from './CLINICAL/glucose/glucose.component';
import { SpO2Component } from './CLINICAL/sp-o2/sp-o2.component';
import { DouleurComponent } from './CLINICAL/douleur/douleur.component';
import { TensionComponent } from './CLINICAL/tension/tension.component';
import { PoolsComponent } from './CLINICAL/pools/pools.component';
import { RapportFinancierComponent } from './RAPPORT/rapport-financier/rapport-financier.component';
import { RapportCliniqueComponent } from './RAPPORT/rapport-clinique/rapport-clinique.component';
import { RapportQualiteComponent } from './RAPPORT/rapport-qualite/rapport-qualite.component';















@NgModule({
  declarations: [
    PinComponent,
    AppComponent,
    PatientListComponent,
    PatienDetailsComponent,
    AddPatientComponent,
    AddAppointmentComponent,
    AppointmentListComponent,
    LoginComponent,
    NavComponent,
    HomeComponent,
    AdminDashboardComponent,
    ClinicalDashboardComponent,
    POCComponent,
    EMARComponent,
    AllLinksComponent,
    AutresComponent,
    PatientListAdComponent,
    NouveauProComponent,
    TableauBordComptComponent,
    UDAComptComponent,
    RapportComponent,
    PatientClinicalComponent,
    SuivitHospiComponent,
    SystemDAtaMedComponent,
    CommunicationComponent,
    OrdersComponent,
    LabResultComponent,
    ManagRiskComponent,
    PoidsSignesVComponent,
    UDAComponent,
    ControlInfectionsComponent,
    TherapyComponent,
    VisitMedicalComponent,
    VaccinationComponent,
    PoidsComponent,
    RespirationComponent,
    GlucoseComponent,
    SpO2Component,
    DouleurComponent,
    TensionComponent,
    PoolsComponent,
    RapportFinancierComponent,
    RapportCliniqueComponent,
    RapportQualiteComponent, 
    
   
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    AngularFireModule.initializeApp(environment.firebase),
    AngularFirestoreModule,
    AngularFireAuthModule,
    AngularFireFunctionsModule,
    BrowserAnimationsModule,
    MatSlideToggleModule,
    DatePipe,

    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatNativeDateModule,
    MatDatepickerModule,
    MatProgressBarModule,
    MatStepperModule,
    MatButtonModule,
    MatTableModule,
    MatPaginatorModule,
    MatIconModule,
    MatCardModule,
    CommonModule,
    
    
    
    
  ],
  providers: [
    { provide: REGION, useValue: 'us-central1' }, {provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: {floatLabel: 'always'}}],
  bootstrap: [AppComponent]
})
export class AppModule { }
