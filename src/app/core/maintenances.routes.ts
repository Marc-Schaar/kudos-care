import { Routes } from '@angular/router';

export const MAINTENANCE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../features/app-maintenance/components/maintenace-page-component/maintenace-page-component').then(
        (m) => m.MaintenacePageComponent,
      ),
  },
  {
    path: 'bikes/:id',
    loadComponent: () =>
      import('../features/app-maintenance/components/detail-bike-component/detail-bike-component').then(
        (m) => m.DetailBikeComponent,
      ),
  },
];
