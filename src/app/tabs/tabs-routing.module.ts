import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs.page';
import { PatientsPage } from '../pages/patients/patients.page';
import { PatientAssessmentsPage } from '../pages/patient-assessments/patient-assessments.page';
import { AssessmentDetailPage } from '../pages/assessments-details/assessments-details.page';
import { AssessmentFormPage } from '../pages/assessment-form/assessment-form.page';
import { WoundHistoryPage } from '../pages/wound-history/wound-history.page';
import { AddPatientPage } from '../pages/add-patient/add-patient.page';
import { ProgressNotePage } from '../pages/progress-note/progress-note.page';
import { ProgressNoteFormPage } from '../pages/progress-note-form/progress-note-form.page';
import { BradenFormPage } from '../pages/braden-form/braden-form.page';
import { WoundCarePlanPage } from '../pages/wound-care-plan/wound-care-plan.page';
import { EducationPage } from '../pages/education/education.page';
import { WoundNotePage } from '../pages/wound-note/wound-note.page';
import { TodayPage } from '../pages/today/today.page';
import { ChatPage } from '../pages/chat/chat.page';
import { MorePage } from '../pages/more/more.page';

const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      { path: 'patients', component: PatientsPage },
      { path: 'today', component: TodayPage },
      { path: 'chat', component: ChatPage },
      { path: 'more', component: MorePage },
      { path: 'add-patient', component: AddPatientPage },
      { path: 'progress-note', component: ProgressNotePage },
      { path: 'progress-note/:patientId', component: ProgressNoteFormPage },
      { path: 'skin-wound/:patientId/assessments', component: PatientAssessmentsPage },
      { path: 'skin-wound/:patientId/wound-note', component: WoundNotePage },
      { path: 'skin-wound/:patientId/education', component: EducationPage },
      { path: 'skin-wound/:patientId/braden', component: BradenFormPage },
      { path: 'skin-wound/:patientId/assessments/new', component: AssessmentFormPage },
      { path: 'skin-wound/:patientId/assessments/:assessmentId/edit', component: AssessmentFormPage },
      { path: 'skin-wound/:patientId/assessments/:assessmentId/care-plan', component: WoundCarePlanPage },
      { path: 'skin-wound/:patientId/assessments/:assessmentId', component: AssessmentDetailPage },
      { path: 'skin-wound/:patientId/wounds/:woundId/history', component: WoundHistoryPage },
      { path: '', redirectTo: '/tabs/patients', pathMatch: 'full' },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TabsPageRoutingModule {}
