import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { LoginPage } from './pages/login/login.page'; // ✅ standalone

const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    component: LoginPage,          // ✅ comme il est standalone
  },
  {
    path: 'tabs',
    loadChildren: () =>
      import('./tabs/tabs.module').then((m) => m.TabsPageModule),
  },
  {
    path: 'patient-assessments',
    loadChildren: () => import('./pages/patient-assessments/patient-assessments.module').then( m => m.PatientAssessmentsPageModule)
  },
  {
    path: 'assessments-details',
    loadChildren: () => import('./pages/assessments-details/assessments-details.module').then( m => m.AssessmentsDetailsPageModule)
  },
  {
    path: 'assessment-form',
    loadChildren: () => import('./pages/assessment-form/assessment-form.module').then( m => m.AssessmentFormPageModule)
  },
  {
    path: 'wound-history',
    loadChildren: () => import('./pages/wound-history/wound-history.module').then( m => m.WoundHistoryPageModule)
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
