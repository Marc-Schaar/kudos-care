import { Routes } from '@angular/router';

import { MenuPage } from './menu/menu-page';
import { SavePage } from './menu/save-page';
import { SettingsPage } from './menu/settings-page';
import { RoutePlanPage } from './nav/route-plan-page';
import { RadcomputerShell } from './radcomputer-shell';
import { RidePage } from './ride/ride-page';
import { WorkoutPage } from './workout/workout-page';

/**
 * Unterseiten des Radcomputers. Bewusst ohne eigenes Lazy Loading: Der ganze Bereich kommt
 * als ein Paket, damit unterwegs ohne Netz kein Seitenwechsel scheitert.
 */
export const RADCOMPUTER_ROUTES: Routes = [
  {
    path: '',
    component: RadcomputerShell,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'fahrt' },
      { path: 'fahrt', title: 'Radcomputer – Kudos Care', component: RidePage },
      { path: 'menue', title: 'Menü – Radcomputer', component: MenuPage },
      { path: 'menue/route', title: 'Routenplanung – Radcomputer', component: RoutePlanPage },
      { path: 'menue/training', title: 'Training – Radcomputer', component: WorkoutPage },
      { path: 'menue/speichern', title: 'Fahrt speichern – Radcomputer', component: SavePage },
      {
        path: 'menue/einstellungen',
        title: 'Einstellungen – Radcomputer',
        component: SettingsPage,
      },
      { path: '**', redirectTo: 'fahrt' },
    ],
  },
];
