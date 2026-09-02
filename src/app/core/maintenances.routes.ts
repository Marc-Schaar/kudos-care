import { Routes } from '@angular/router';

/**
 * Der Wartungsbereich liegt komplett in der Shell (`MaintenanceShellComponent`),
 * damit die untere Navigationsleiste beim Seitenwechsel stehen bleibt.
 *
 * Ein Bike hat zwei Seiten statt einer: `bikes/:id` zeigt nur den Zustand,
 * `bikes/:id/werkstatt` enthält alles, was etwas verändert. Vorher lag beides
 * in einer einzigen Detailseite. Eine einzelne Baugruppe bekommt unter
 * `bikes/:id/werkstatt/:assemblyId` nochmal eine eigene Seite — vorher war das
 * ein Expansion Panel in der Werkstatt-Liste.
 */
export const MAINTENANCE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../features/app-maintenance/components/maintenance-shell-component/maintenance-shell-component').then(
        (m) => m.MaintenanceShellComponent,
      ),
    children: [
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
          import('../features/app-maintenance/components/bike-condition-page/bike-condition-page').then(
            (m) => m.BikeConditionPage,
          ),
      },
      {
        path: 'bikes/:id/werkstatt',
        loadComponent: () =>
          import('../features/app-maintenance/components/bike-service-page/bike-service-page').then(
            (m) => m.BikeServicePage,
          ),
      },
      {
        // Detailseite einer Baugruppe. Liegt bewusst UNTER werkstatt/, damit der
        // Tab "Werkstatt" in der unteren Navigation aktiv bleibt — der nutzt
        // routerLinkActive ohne `exact`.
        path: 'bikes/:id/werkstatt/:assemblyId',
        loadComponent: () =>
          import('../features/app-maintenance/components/assembly-detail-page/assembly-detail-page').then(
            (m) => m.AssemblyDetailPage,
          ),
      },
    ],
  },
];
