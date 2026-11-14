import { Component, inject, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { Router } from '@angular/router';

import { DemoDriver } from '../core/demo-driver';
import { fmtDistance, num } from '../core/format';
import { Gps } from '../core/gps';
import { Place } from '../core/models';
import { RideView } from '../core/ride-view';
import { Strava, StravaRoute } from '../core/strava';
import { Toasts } from '../core/toasts';
import { SubHeader } from '../menu/sub-header';
import { Geocoder } from './geocoder';
import { RouteGuide } from './route-guide';
import { SavedPlaces } from './saved-places';
import { RC } from '../core/paths';

/** Routen laden und Ziele wählen. Danach geht es direkt auf die Kartenseite der Fahrt. */
@Component({
  selector: 'rc-route-plan-page',
  imports: [FormField, SubHeader],
  templateUrl: './route-plan-page.html',
  styleUrl: './route-plan-page.css',
})
export class RoutePlanPage {
  protected readonly guide = inject(RouteGuide);
  protected readonly gps = inject(Gps);
  protected readonly places = inject(SavedPlaces);
  protected readonly demo = inject(DemoDriver);
  protected readonly strava = inject(Strava);
  private readonly geocoder = inject(Geocoder);
  private readonly toasts = inject(Toasts);
  private readonly router = inject(Router);
  private readonly view = inject(RideView);

  protected readonly fmtDistance = fmtDistance;
  protected readonly num = num;
  protected readonly searchModel = signal({ query: '', placeName: '' });
  protected readonly searchForm = form(this.searchModel);
  protected readonly results = signal<Place[] | null>(null);
  protected readonly searching = signal(false);

  protected readonly stravaRoutes = signal<StravaRoute[] | null>(null);
  protected readonly stravaMore = signal(false);
  protected readonly stravaLoading = signal<string | null>(null);
  private stravaPage = 1;

  constructor() {
    this.gps.start();
  }

  /** Nach dem Laden auf die Kartenseite der Fahrt wechseln. */
  private showOnMap(): void {
    this.view.show('map');
    void this.router.navigateByUrl(RC.ride);
  }

  protected async onGpxSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // dieselbe Datei später erneut wählbar
    if (file && (await this.guide.loadGpx(file))) this.showOnMap();
  }

  protected async loadStravaList(more = false): Promise<void> {
    this.stravaPage = more ? this.stravaPage + 1 : 1;
    this.stravaLoading.set('list');
    try {
      const res = await this.strava.routes(this.stravaPage);
      this.stravaRoutes.update((list) => (more && list ? [...list, ...res.routes] : res.routes));
      this.stravaMore.set(res.more);
    } catch (err) {
      this.toasts.show(err instanceof Error ? err.message : 'Strava-Routen nicht geladen.', 6000);
    } finally {
      this.stravaLoading.set(null);
    }
  }

  protected async loadStravaRoute(route: StravaRoute): Promise<void> {
    this.stravaLoading.set(route.id);
    try {
      const gpx = await this.strava.routeGpx(route.id);
      if (this.guide.loadGpxText(gpx, route.name)) this.showOnMap();
    } catch (err) {
      this.toasts.show(err instanceof Error ? err.message : 'Route nicht geladen.', 6000);
    } finally {
      this.stravaLoading.set(null);
    }
  }

  protected async search(event: Event): Promise<void> {
    event.preventDefault();
    const query = this.searchModel().query.trim();
    if (query.length < 3) {
      this.toasts.show('Bitte mindestens drei Zeichen eingeben.');
      return;
    }
    this.searching.set(true);
    try {
      this.results.set(await this.geocoder.search(query, this.gps.fix()));
    } catch {
      this.results.set(null);
      this.toasts.show(
        navigator.onLine === false
          ? 'Keine Verbindung. Die Suche braucht Internet.'
          : 'Die Suche ist fehlgeschlagen.',
      );
    } finally {
      this.searching.set(false);
    }
  }

  protected async goTo(place: Place): Promise<void> {
    if (await this.guide.navigateTo(place)) this.showOnMap();
  }

  protected save(place: Place): void {
    this.places.add(place);
    this.toasts.show(`Gespeichert: ${place.name}`);
  }

  /** Legt den aktuellen Standort als festes Ziel ab, z. B. „Zuhause“. */
  protected saveCurrent(event: Event): void {
    event.preventDefault();
    const fix = this.gps.fix();
    const name = this.searchModel().placeName.trim();
    if (!fix) {
      this.toasts.show('Noch kein Standort. Warte auf GPS.');
      return;
    }
    if (!name) {
      this.toasts.show('Bitte einen Namen eingeben, z. B. Zuhause.');
      return;
    }
    this.places.add({ name, lat: fix.lat, lon: fix.lon });
    this.searchModel.update((m) => ({ ...m, placeName: '' }));
    this.toasts.show(`Gespeichert: ${name}`);
  }

  protected loadDemoRoute(): void {
    this.demo.loadSampleRoute();
    this.showOnMap();
  }
}
