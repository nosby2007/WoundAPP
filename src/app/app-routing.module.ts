import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { LoginPage } from './pages/login/login.page'; // ✅ standalone
import { PinPage } from './pages/pin/pin.page';
import { pinGuard } from './guards/pin.guard';

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
    // Signed in but not yet unlocked. Deliberately NOT behind pinGuard --
    // the PIN screen would guard itself and nobody could ever reach it.
    path: 'pin',
    component: PinPage,
  },
  {
    path: 'tabs',
    canActivate: [pinGuard],
    loadChildren: () =>
      import('./tabs/tabs.module').then((m) => m.TabsPageModule),
  },
  {
    path: 'patient-assessments',
    canActivate: [pinGuard],
    loadChildren: () => import('./pages/patient-assessments/patient-assessments.module').then( m => m.PatientAssessmentsPageModule)
  },
  {
    path: 'assessments-details',
    canActivate: [pinGuard],
    loadChildren: () => import('./pages/assessments-details/assessments-details.module').then( m => m.AssessmentsDetailsPageModule)
  },
  {
    path: 'assessment-form',
    canActivate: [pinGuard],
    loadChildren: () => import('./pages/assessment-form/assessment-form.module').then( m => m.AssessmentFormPageModule)
  },
  {
    path: 'wound-history',
    canActivate: [pinGuard],
    loadChildren: () => import('./pages/wound-history/wound-history.module').then( m => m.WoundHistoryPageModule)
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
