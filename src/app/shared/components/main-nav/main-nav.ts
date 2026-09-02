import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { BikeService } from '../../../features/app-maintenance/services/bike-service/bike-service';
import { NavigationService } from '../../../shared/services/navigation-service/navigation-service';

/**
 * Die zentrale Navigationsleiste der App — fix am unteren Rand.
 *
 * Lag zuerst nur im Wartungsbereich. Sobald sie aber auf Fahrten verweist, muss
 * sie auch dort stehen bleiben, sonst führt der Weg aus der Wartung heraus in
 * eine Seite ohne Rückweg. Deshalb liegt sie jetzt in der App-Shell und gilt
 * für alles.
 *
 * Zwei der fünf Ziele hängen an einem Bike ("Zustand", "Werkstatt"). Solange
 * keins gewählt ist, sind sie deaktiviert statt versteckt — eine Leiste, die
 * ihre Anzahl ändert, springt beim Navigieren.
 *
 * Ausgeblendet auf den öffentlichen Routen (Login, Landing, Strava-Callback) —
 * dort gibt es nichts zu navigieren. Die Sichtbarkeit hängt bewusst an der
 * Route und nicht am angemeldeten Nutzer: `StravaService.user` wird erst
 * befüllt, wenn eine Seite es anstößt, und die Wartungsseiten tun das nicht.
 * Die Leiste wäre dort beim Direktaufruf verschwunden.
 */
@Component({
  selector: 'app-main-nav',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './main-nav.html',
  styleUrl: './main-nav.css',
})
export class MainNav {
  readonly nav = inject(NavigationService);
  private readonly bikeService = inject(BikeService);
  private readonly router = inject(Router);

  /** Routen ohne Navigation — alles davor liegt vor dem Login. */
  private static readonly PUBLIC_ROUTES = ['/login', '/landingpage', '/strava-callback'];

  private readonly url = signal(this.router.url);

  readonly visible = computed(() => {
    const url = this.url();
    if (url === '/') return false;
    return !MainNav.PUBLIC_ROUTES.some((route) => url.startsWith(route));
  });

  /**
   * Das zuletzt geöffnete Bike. `selectedBike` wird von `fetchBikeDetails()`
   * gesetzt und überlebt den Wechsel auf andere Bereiche — genau das macht die
   * beiden Bike-Ziele von überall aus erreichbar.
   */
  readonly bikeId = computed(() => this.bikeService.selectedBike()?.id ?? null);

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.url.set(event.urlAfterRedirects));
  }
}
