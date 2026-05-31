import { Routes } from '@angular/router';
import { Dashboard } from './app/features/app-dashboard/components/dashboard/dashboard';
import { Login } from './app/features/app-login/components/login/login';
import { StravaCallback } from './app/features/app-login/components/strava-callback/strava-callback';
import { authGuard } from './app/features/app-login/guard/auth-guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: Login },
  { path: 'strava-callback', component: StravaCallback },
  { path: 'dashboard', canActivate: [authGuard], component: Dashboard },
  {
    path: 'activity/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./app/features/app-activity/components/activity-detail/activity-detail').then(
        (m) => m.ActivityDetail,
      ),
  },

  {
    path: 'maintenance',
    loadChildren: () => import('./maintenances.routes').then((m) => m.MAINTENANCE_ROUTES),
  },
];
