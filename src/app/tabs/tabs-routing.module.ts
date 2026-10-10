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
import { PatientClinicalContextPage } from '../pages/patient-clinical-context/patient-clinical-context.page';
import { SystemicAssessmentPage } from '../pages/systemic-assessment/systemic-assessment.page';
import { GeneralClinicalAssessmentPage } from '../pages/general-clinical-assessment/general-clinical-assessment.page';
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
import { SchedulerWorkspacePage } from '../pages/scheduler-workspace/scheduler-workspace.page';
import { ReceptionPatientsPage } from '../pages/reception-patients/reception-patients.page';
import { IntakePatientPage } from '../pages/intake-patient/intake-patient.page';
import { VisitCompletePage } from '../pages/visit-complete/visit-complete.page';
import { SyncReviewPage } from '../pages/sync-review/sync-review.page';
import { telehealthFacilitatorGuard } from '../guards/telehealth.guard';

const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      { path: 'telehealth/session/:appointmentId', loadComponent: () => import('../pages/telehealth/telehealth-session.page').then(m => m.TelehealthSessionPage), canActivate: [fieldAccessGuard], data: { access: 'clinical' } },
      { path: 'telehealth', loadComponent: () => import('../pages/telehealth/telehealth.page').then(m => m.TelehealthPage), canActivate: [telehealthFacilitatorGuard] },
      { path: 'patients', component: PatientsPage, canActivate: [fieldAccessGuard], data: { access: 'clinical' } },
      { path: 'patients/:patientId/clinical-background', component: PatientClinicalContextPage, canActivate: [fieldAccessGuard], data: {access:'clinical'} },
      { path: 'today', component: TodayPage, canActivate: [fieldAccessGuard], data: { access: 'field' } },
      { path: 'sync-review', component: SyncReviewPage, canActivate: [fieldAccessGuard], data: { access: 'field' } },
      { path: 'today/visit/:appointmentId/complete', component: VisitCompletePage, canActivate: [fieldAccessGuard], data: { access: 'field' } },
      { path: 'today/visit/:appointmentId', component: FieldVisitPage, canActivate: [fieldAccessGuard], data: { access: 'field' } },
      { path: 'today/task/:taskId', component: FieldTaskPage, canActivate: [fieldAccessGuard], data: { access: 'field' } },
      { path: 'my-schedule', component: MySchedulePage, canActivate: [fieldAccessGuard], data: { access: 'field' } },
      { path: 'wound-rounds', component: WoundRoundsPage, canActivate: [fieldAccessGuard], data: { access: 'wound-round-review' } },
      { path: 'wound-rounds/:roundId/patients/:patientId/assessments/:assessmentId', component: AssessmentDetailPage, canActivate: [fieldAccessGuard], data: { access: 'wound-round-review', readOnly: true } },
      { path: 'wound-rounds/:roundId', component: WoundRoundDetailPage, canActivate: [fieldAccessGuard], data: { access: 'wound-round-review' } },
      { path: 'chat', component: ChatPage },
      { path: 'more', component: MorePage },
      { path: 'visit-history', component: VisitHistoryPage, canActivate: [fieldAccessGuard], data: { access: 'clinical' } },
      { path: 'visit-history/:patientId/:visitId', component: VisitHistoryDetailPage, canActivate: [fieldAccessGuard], data: { access: 'clinical' } },
      { path: 'scheduler', component: SchedulerWorkspacePage, canActivate: [fieldAccessGuard], data: { access: 'scheduling' } },
      { path: 'intake-patients', component: ReceptionPatientsPage, canActivate: [fieldAccessGuard], data: { access: 'scheduling' } },
      { path: 'intake-patient/:patientId', component: IntakePatientPage, canActivate: [fieldAccessGuard], data: { access: 'scheduling' } },
      { path: 'add-patient', component: AddPatientPage, canActivate: [fieldAccessGuard], data: { access: 'intake' } },
      { path: 'progress-note', component: ProgressNotePage, canActivate: [fieldAccessGuard], data: { access: 'clinical' } },
      { path: 'progress-note/:patientId', component: ProgressNoteFormPage, canActivate: [fieldAccessGuard], data: { access: 'clinical' } },
      { path: 'skin-wound/:patientId/assessments', component: PatientAssessmentsPage, canActivate: [fieldAccessGuard], data: { access: 'clinical' } },
      { path: 'skin-wound/:patientId/wound-note', component: WoundNotePage, canActivate: [fieldAccessGuard], data: { access: 'clinical' } },
      { path: 'skin-wound/:patientId/education', component: EducationPage, canActivate: [fieldAccessGuard], data: { access: 'clinical' } },
      { path: 'skin-wound/:patientId/braden', component: BradenFormPage, canActivate: [fieldAccessGuard], data: { access: 'clinical' } },
      { path: 'skin-wound/:patientId/systemic-assessment', component: SystemicAssessmentPage, canActivate: [fieldAccessGuard], data: { access: 'clinical' } },
      { path: 'skin-wound/:patientId/general-assessment', component: GeneralClinicalAssessmentPage, canActivate: [fieldAccessGuard], data: { access: 'clinical' } },
      { path: 'skin-wound/:patientId/orders', component: ClinicalOrderPage, canActivate: [fieldAccessGuard, clinicalRoleGuard], data: { access: 'clinical', roles: ['provider','np','nurse','rn','lpn','lvn','md','do','physician','wound_nurse_internal'] } },
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
