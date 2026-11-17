import { Component, computed, inject, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { Router } from '@angular/router';

import { DemoDriver } from '../core/demo-driver';
import { fmtDistance, num } from '../core/format';
import { haversine } from '../core/geo';
import { Gps } from '../core/gps';
import { Heading } from '../core/heading';
import { Place } from '../core/models';
import { RideView } from '../core/ride-view';
import { SettingsStore } from '../core/settings-store';
import { Strava, StravaRoute } from '../core/strava';
import { Toasts } from '../core/toasts';
import { SubHeader } from '../menu/sub-header';
import { Geocoder } from './geocoder';
import { MapCanvas, TILE_SOURCES } from './map-canvas';
import { MapCamera } from './map-camera';
import { NavRoute } from './nav-models';
import { RouteGuide } from './route-guide';
import { SavedPlaces } from './saved-places';
import { RC } from '../core/paths';

/** Erst ab diesem Abstand zum Routenstart ist er eine Angabe wert (m). */
const START_HINT_M = 150;

interface PendingRoute {
  route: NavRoute;
  /** `new` wird gestartet, `demo` startet die Simulation mit, `current` läuft schon. */
  source: 'new' | 'demo' | 'current';
}

/**
 * Routen laden und Ziele wählen. Jede neue Route erscheint erst als Vorschau mit der
 * ganzen Strecke; „Route starten“ übernimmt sie und wechselt auf die Kartenseite.
 */
@Component({
  selector: 'rc-route-plan-page',
  imports: [FormField, SubHeader, MapCanvas],
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
  protected readonly settings = inject(SettingsStore);
  protected readonly heading = inject(Heading);

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

  /** Route in der Vorschau; die laufende Führung bleibt bis zum Start unberührt. */
  protected readonly pending = signal<PendingRoute | null>(null);
  /** Von Hand verschobene Vorschau; `null` = die ganze Route. */
  protected readonly previewCamera = signal<MapCamera | null>(null);
  /** Zählt Ladevorgänge: eine späte Antwort verdrängt keine neuere Wahl. */
  private ticket = 0;

  protected readonly attribution = computed(
    () => (TILE_SOURCES[this.settings.value().mapStyle] ?? TILE_SOURCES.osm).attribution,
  );
  /** Liegt der Start einer geladenen Route woanders, steht in der Vorschau, wie weit. */
  protected readonly startDistance = computed(() => {
    const p = this.pending();
    const fix = this.gps.fix();
    if (!p || p.source === 'current' || !fix) return null;
    const start = p.route.points[0];
    const d = haversine(fix.lat, fix.lon, start.lat, start.lon);
    return d > START_HINT_M ? fmtDistance(d) : null;
  });

  constructor() {
    this.gps.start();
  }

  /** Auf die Kartenseite der Fahrt, mit der Karte wieder am Standort. */
  private showOnMap(): void {
    this.view.recenterMap();
    this.view.show('map');
    void this.router.navigateByUrl(RC.ride);
  }

  private openPreview(route: NavRoute, source: PendingRoute['source']): void {
    this.ticket += 1;
    this.previewCamera.set(null);
    this.pending.set({ route, source });
  }

  /** Lädt eine Route und zeigt sie zur Vorschau, sofern inzwischen nichts anderes gewählt wurde. */
  private async offer(load: () => Promise<NavRoute | null>): Promise<void> {
    const ticket = ++this.ticket;
    const route = await load();
    if (route && ticket === this.ticket) this.openPreview(route, 'new');
  }

  protected viewCurrent(): void {
    const route = this.guide.route();
    if (route) this.openPreview(route, 'current');
  }

  protected closePreview(): void {
    this.ticket += 1;
    this.pending.set(null);
  }

  protected startPending(): void {
    const p = this.pending();
    if (!p) return;
    if (p.source === 'new') this.guide.start(p.route);
    else if (p.source === 'demo') this.demo.loadSampleRoute(p.route);
    this.pending.set(null);
    this.showOnMap();
  }

  protected async onGpxSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // dieselbe Datei später erneut wählbar
    if (file) await this.offer(() => this.guide.routeFromFile(file));
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
      await this.offer(async () =>
        this.guide.routeFromGpx(await this.strava.routeGpx(route.id), route.name),
      );
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
    await this.offer(() => this.guide.plan(place));
  }

  protected async save(place: Place): Promise<void> {
    this.toasts.show(
      (await this.places.add(place))
        ? `Gespeichert: ${place.name}`
        : 'Speichern fehlgeschlagen. Die Ziele brauchen Internet.',
    );
  }

  protected async removePlace(place: Place): Promise<void> {
    if (!(await this.places.remove(place))) {
      this.toasts.show('Löschen fehlgeschlagen. Die Ziele brauchen Internet.');
    }
  }

  /** Legt den aktuellen Standort als festes Ziel ab, z. B. „Zuhause“. */
  protected async saveCurrent(event: Event): Promise<void> {
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
    if (!(await this.places.add({ name, lat: fix.lat, lon: fix.lon }))) {
      this.toasts.show('Speichern fehlgeschlagen. Die Ziele brauchen Internet.');
      return;
    }
    this.searchModel.update((m) => ({ ...m, placeName: '' }));
    this.toasts.show(`Gespeichert: ${name}`);
  }

  protected loadDemoRoute(): void {
    this.openPreview(this.demo.sampleRoute(), 'demo');
  }
}
