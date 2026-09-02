import { Routes } from '@angular/router';

/**
 * Routen des Wartungsbereichs.
 *
 * Ein Bike hat zwei Seiten statt einer: `bikes/:id` zeigt nur den Zustand,
 * `bikes/:id/werkstatt` enthält alles, was etwas verändert. Eine einzelne
 * Baugruppe bekommt unter `bikes/:id/werkstatt/:assemblyId` nochmal eine eigene
 * Seite — vorher war das ein Expansion Panel in der Werkstatt-Liste.
 *
 * Die Navigationsleiste liegt bewusst NICHT mehr hier, sondern in der
 * App-Shell (`shared/components/main-nav`): sobald sie auf Fahrten und Start
 * verweist, muss sie auch dort stehen bleiben.
 */
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
    // Detailseite einer Baugruppe. Liegt unter werkstatt/, damit der Tab in der
    // Navigation aktiv bleibt — der nutzt routerLinkActive ohne `exact`.
    path: 'bikes/:id/werkstatt/:assemblyId',
    loadComponent: () =>
      import('../features/app-maintenance/components/assembly-detail-page/assembly-detail-page').then(
        (m) => m.AssemblyDetailPage,
      ),
  },
];
