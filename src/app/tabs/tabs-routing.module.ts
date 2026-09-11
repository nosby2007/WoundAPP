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
import { PatientCarePlanPage } from '../pages/patient-care-plan/patient-care-plan.page';
import { ClinicalOrderPage } from '../pages/clinical-order/clinical-order.page';
import { SystemicAssessmentPage } from '../pages/systemic-assessment/systemic-assessment.page';
import { EducationPage } from '../pages/education/education.page';
import { WoundNotePage } from '../pages/wound-note/wound-note.page';
import { TodayPage } from '../pages/today/today.page';
import { ChatPage } from '../pages/chat/chat.page';
import { MorePage } from '../pages/more/more.page';
import { FieldVisitPage } from '../pages/field-visit/field-visit.page';
import { FieldTaskPage } from '../pages/field-task/field-task.page';
import { MySchedulePage } from '../pages/my-schedule/my-schedule.page';
import { WoundRoundsPage } from '../pages/wound-rounds/wound-rounds.page';
import { WoundRoundDetailPage } from '../pages/wound-round-detail/wound-round-detail.page';
import { clinicalRoleGuard } from '../guards/clinical-role.guard';
import { fieldAccessGuard } from '../guards/field-access.guard';
import { VisitHistoryPage } from '../pages/visit-history/visit-history.page';
import { VisitHistoryDetailPage } from '../pages/visit-history-detail/visit-history-detail.page';

const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      { path: 'patients', component: PatientsPage, canActivate: [fieldAccessGuard], data: { access: 'clinical' } },
      { path: 'today', component: TodayPage, canActivate: [fieldAccessGuard], data: { access: 'field' } },
      { path: 'today/visit/:appointmentId', component: FieldVisitPage, canActivate: [fieldAccessGuard], data: { access: 'field' } },
      { path: 'today/task/:taskId', component: FieldTaskPage, canActivate: [fieldAccessGuard], data: { access: 'field' } },
      { path: 'my-schedule', component: MySchedulePage, canActivate: [fieldAccessGuard], data: { access: 'field' } },
      { path: 'wound-rounds', component: WoundRoundsPage, canActivate: [fieldAccessGuard], data: { access: 'clinical' } },
      { path: 'wound-rounds/:roundId', component: WoundRoundDetailPage, canActivate: [fieldAccessGuard], data: { access: 'clinical' } },
      { path: 'chat', component: ChatPage },
      { path: 'more', component: MorePage },
      { path: 'visit-history', component: VisitHistoryPage, canActivate: [fieldAccessGuard], data: { access: 'clinical' } },
      { path: 'visit-history/:patientId/:visitId', component: VisitHistoryDetailPage, canActivate: [fieldAccessGuard], data: { access: 'clinical' } },
      { path: 'add-patient', component: AddPatientPage, canActivate: [fieldAccessGuard], data: { access: 'clinical' } },
      { path: 'progress-note', component: ProgressNotePage, canActivate: [fieldAccessGuard], data: { access: 'clinical' } },
      { path: 'progress-note/:patientId', component: ProgressNoteFormPage, canActivate: [fieldAccessGuard], data: { access: 'clinical' } },
      { path: 'skin-wound/:patientId/assessments', component: PatientAssessmentsPage, canActivate: [fieldAccessGuard], data: { access: 'clinical' } },
      { path: 'skin-wound/:patientId/wound-note', component: WoundNotePage, canActivate: [fieldAccessGuard], data: { access: 'clinical' } },
      { path: 'skin-wound/:patientId/education', component: EducationPage, canActivate: [fieldAccessGuard], data: { access: 'clinical' } },
      { path: 'skin-wound/:patientId/braden', component: BradenFormPage, canActivate: [fieldAccessGuard], data: { access: 'clinical' } },
      { path: 'skin-wound/:patientId/systemic-assessment', component: SystemicAssessmentPage, canActivate: [fieldAccessGuard], data: { access: 'clinical' } },
      { path: 'skin-wound/:patientId/orders', component: ClinicalOrderPage, canActivate: [fieldAccessGuard, clinicalRoleGuard], data: { access: 'clinical', roles: ['provider','np','nurse','rn','lpn','lvn','md','do','physician','wound_nurse','wound_nurse_internal','don'] } },
      { path: 'skin-wound/:patientId/care-plan', component: PatientCarePlanPage, canActivate: [fieldAccessGuard], data: { access: 'clinical' } },
      { path: 'skin-wound/:patientId/assessments/new', component: AssessmentFormPage, canActivate: [fieldAccessGuard], data: { access: 'clinical' } },
      { path: 'skin-wound/:patientId/assessments/:assessmentId/edit', component: AssessmentFormPage, canActivate: [fieldAccessGuard], data: { access: 'clinical' } },
      { path: 'skin-wound/:patientId/assessments/:assessmentId/care-plan', component: WoundCarePlanPage, canActivate: [fieldAccessGuard], data: { access: 'clinical' } },
      { path: 'skin-wound/:patientId/assessments/:assessmentId', component: AssessmentDetailPage, canActivate: [fieldAccessGuard], data: { access: 'clinical' } },
      { path: 'skin-wound/:patientId/wounds/:woundId/history', component: WoundHistoryPage, canActivate: [fieldAccessGuard], data: { access: 'clinical' } },
      { path: '', redirectTo: '/tabs/patients', pathMatch: 'full' },
    ],
  },
];

@NgModule({ imports: [RouterModule.forChild(routes)], exports: [RouterModule] })
export class TabsPageRoutingModule {}
