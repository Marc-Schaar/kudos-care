import { inject, Injectable } from '@angular/core';
import { NavigationExtras, Router } from '@angular/router';

/** Was der Router als Ziel akzeptiert — Segmente und Parameter. */
export type RouteCommands = (string | number)[];

/**
 * Ein Ort für alle Wege durch die App.
 *
 * Vorher standen die Pfade als Literale in Komponenten und Templates verstreut,
 * und sie waren bereits auseinandergelaufen: dieselbe Bike-Seite hieß an einer
 * Stelle `['/maintenance/bikes', id]` und an anderer `['/maintenance', 'bikes',
 * id]`. Beides funktioniert, aber eine Routenänderung hätte man an jeder Stelle
 * einzeln finden müssen.
 *
 * `to` liefert die Segmente — für `[routerLink]` im Template.
 * `goTo()` navigiert direkt — für den Code.
 *
 * Beide Wege teilen sich dieselbe Definition, deshalb gibt es die Pfade nur
 * einmal.
 */
@Injectable({ providedIn: 'root' })
export class NavigationService {
  private readonly router = inject(Router);

  /**
   * Die Ziele der App. Als Funktionen statt als Konstanten, damit Parameter
   * (Bike, Baugruppe) typisiert mitgehen und kein Aufrufer die Segmente selbst
   * zusammensetzt.
   */
  readonly to = {
    /** Öffentliche Marketing-Startseite — bewusst außerhalb von `/app`. */
    landing: (): RouteCommands => ['/'],
    imprint: (): RouteCommands => ['/impressum'],
    privacy: (): RouteCommands => ['/datenschutz'],
    login: (): RouteCommands => ['/app/login'],
    dashboard: (): RouteCommands => ['/app/dashboard'],

    activities: (): RouteCommands => ['/app/activities'],
    /** Radcomputer am Lenker: eigener Vollbild-Bereich, seine Unterseiten führt er selbst. */
    radcomputer: (): RouteCommands => ['/app/radcomputer'],
    activity: (activityId: number): RouteCommands => ['/app/activity', activityId],

    /** Bike-Liste im Wartungsbereich. */
    bikes: (): RouteCommands => ['/app/maintenance'],
    /** Ein Rad: was fällig ist, seine Laufräder und Baugruppen. */
    bike: (bikeId: number): RouteCommands => ['/app/maintenance', 'bikes', bikeId],
    /** Eine einzelne Baugruppe mit ihren Plätzen und Teilen. */
    assembly: (bikeId: number, assemblyId: number): RouteCommands => [
      '/app/maintenance',
      'bikes',
      bikeId,
      'baugruppen',
      assemblyId,
    ],
  } as const;

  /**
   * Navigiert zu einem Ziel aus `to`.
   *
   * Beispiel: `nav.goTo(nav.to.bike(bikeId))`
   */
  goTo(commands: RouteCommands, extras?: NavigationExtras): Promise<boolean> {
    return this.router.navigate(commands, extras);
  }
}
