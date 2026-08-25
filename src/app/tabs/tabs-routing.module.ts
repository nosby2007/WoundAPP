import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs.page';
import { PatientsPage } from '../pages/patients/patients.page'; // ✅ standalone
import { PatientAssessmentsPage } from '../pages/patient-assessments/patient-assessments.page';
import { AssessmentDetailPage } from '../pages/assessments-details/assessments-details.page';
import { AssessmentFormPage } from '../pages/assessment-form/assessment-form.page';
import { WoundHistoryPage } from '../pages/wound-history/wound-history.page';
import { AddPatientPage } from '../pages/add-patient/add-patient.page';
import { ProgressNotePage } from '../pages/progress-note/progress-note.page';
import { ProgressNoteFormPage } from '../pages/progress-note-form/progress-note-form.page';

const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      {
        path: 'patients',
        component: PatientsPage,   // ✅ la page Patients dans le tab
      },

      {
        path: 'add-patient',
        component: AddPatientPage, // Field intake: register a patient, then go straight into their assessments
      },

      // Quick bedside documentation. The tab lands on the roster because a
      // note needs a patient; picking one opens the note itself.
      {
        path: 'progress-note',
        component: ProgressNotePage,
      },
      {
        path: 'progress-note/:patientId',
        component: ProgressNoteFormPage,
      },

      // Tu pourras réutiliser tab2 / tab3 plus tard
      // {
      //   path: 'tab2',
      //   loadChildren: () =>
      //     import('../tab2/tab2.module').then(m => m.Tab2PageModule),
      // },
      // {
      //   path: 'tab3',
      //   loadChildren: () =>
      //     import('../tab3/tab3.module').then(m => m.Tab3PageModule),
      // },
       {
        path: 'skin-wound/:patientId/assessments', component: PatientAssessmentsPage,  // ✅ la page Patient Assessments dans le tab
      },

       {
        path: 'skin-wound/:patientId/assessments/new',
        component: AssessmentFormPage, // ✅ la page Patient Assessments dans le tab
      },

      {
        path: 'skin-wound/:patientId/assessments/:assessmentId/edit',
        component: AssessmentFormPage,
      },
      {
        path: 'skin-wound/:patientId/assessments/:assessmentId',
        component: AssessmentDetailPage,  // ✅ la page Patient Assessments dans le tab
      },
       {
        path: 'skin-wound/:patientId/wounds/:woundId/history',
        component: WoundHistoryPage,           // ✅ nouvelle page
      },

      {
        path: '',
        redirectTo: '/tabs/patients',
        pathMatch: 'full',
      },
    ],
  },
  
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TabsPageRoutingModule {}
