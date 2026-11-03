import { Routes } from '@angular/router';

/**
 * Routen des Wartungsbereichs: drei Ebenen, die dem entsprechen, wie man über sein Rad
 * nachdenkt — Räder, ein Rad, eine Baugruppe. Verändert wird dort, wo man gerade ist, per
 * Bottom Sheet über der Seite; es gibt keine getrennten Seiten zum Ansehen und Ändern mehr.
 *
 * Die Navigationsleiste liegt bewusst NICHT hier, sondern in der App-Shell
 * (`shared/components/main-nav`): sobald sie auf Fahrten und Start verweist, muss sie
 * auch dort stehen bleiben.
 */
export const MAINTENANCE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../features/app-maintenance/pages/bike-list/bike-list').then((m) => m.BikeListPage),
  },
  {
    path: 'bikes/:id',
    loadComponent: () =>
      import('../features/app-maintenance/pages/bike-page/bike-page').then((m) => m.BikePage),
  },
  {
    path: 'bikes/:id/baugruppen/:assemblyId',
    loadComponent: () =>
      import('../features/app-maintenance/pages/assembly-page/assembly-page').then(
        (m) => m.AssemblyPage,
      ),
  },
  // Alte Adressen, die in Lesezeichen stehen können.
  { path: 'bikes/:id/werkstatt', redirectTo: 'bikes/:id' },
  { path: 'bikes/:id/werkstatt/:assemblyId', redirectTo: 'bikes/:id/baugruppen/:assemblyId' },
];
