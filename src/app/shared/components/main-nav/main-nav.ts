import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { BikeService } from '../../../features/app-maintenance/services/bike-service/bike-service';
import { NavigationService } from '../../../shared/services/navigation-service/navigation-service';
import { StravaService } from '../../services/strava-service/strava-service';
import { Icon } from '../icon/icon';
import { UserMenu } from '../user-menu/user-menu';

/** Routen ohne App-Chrome: alles davor liegt vor dem Login. */
const PUBLIC_ROUTES = ['/app/login', '/app/strava-callback', '/impressum', '/datenschutz'];

/** Gehört diese Adresse zum Bereich nach dem Login? Entscheidet über Navigation und Layout. */
export function isAppRoute(url: string): boolean {
  const path = url.split(/[?#]/)[0];
  if (path === '/' || path === '/landingpage') return false;
  return !PUBLIC_ROUTES.some((route) => path.startsWith(route));
}

/**
 * Das Chrome der App: am Handy Kopfzeile und untere Leiste, am Desktop eine Seitenleiste.
 *
 * Lag zuerst nur im Wartungsbereich. Sobald sie aber auf Fahrten verweist, muss sie auch dort
 * stehen bleiben, sonst führt der Weg aus der Wartung heraus in eine Seite ohne Rückweg. Das
 * Benutzermenü liegt aus demselben Grund hier statt in einzelnen Seiten-Headern: dort fehlte
 * es auf den Fahrten und auf jeder Rad-Seite.
 *
 * "Mein Rad" hängt an einem Bike. Solange keins gewählt ist, ist es deaktiviert statt
 * versteckt: eine Leiste, die ihre Anzahl ändert, springt beim Navigieren.
 *
 * Die Sichtbarkeit hängt bewusst an der Route und nicht am angemeldeten Nutzer:
 * `StravaService.user` wird erst befüllt, wenn etwas es anstößt, und die Wartungsseiten tun das
 * nicht. Deshalb stößt diese Komponente es selbst an, sonst bliebe das Menü dort leer.
 */
@Component({
  selector: 'app-main-nav',
  imports: [RouterLink, RouterLinkActive, Icon, UserMenu],
  templateUrl: './main-nav.html',
  styleUrl: './main-nav.css',
})
export class MainNav {
  readonly nav = inject(NavigationService);
  private readonly bikeService = inject(BikeService);
  private readonly stravaService = inject(StravaService);
  private readonly router = inject(Router);

  private readonly url = signal(this.router.url);

  readonly visible = computed(() => isAppRoute(this.url()));

  /**
   * Das zuletzt geöffnete Bike, sonst das erste aktive. `selectedBike` wird von
   * `fetchBikeDetails()` gesetzt und überlebt den Wechsel auf andere Bereiche.
   */
  readonly bikeId = computed(
    () =>
      this.bikeService.selectedBike()?.id ??
      this.bikeService.bikes().find((bike) => !bike.retired)?.id ??
      null,
  );

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.url.set(event.urlAfterRedirects));

    effect(() => {
      if (!this.visible()) return;
      untracked(() => {
        if (this.stravaService.user() === null) {
          this.stravaService.fetchUser().subscribe({ error: () => undefined });
        }
        if (this.bikeService.bikes().length === 0) {
          this.bikeService.fetchBikes().subscribe({ error: () => undefined });
        }
      });
    });
  }
}
