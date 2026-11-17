import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { SKIP_ERROR_TOAST } from '../../../core/interceptors/error-interceptor/error-interceptor';
import { Place, RoutingProvider } from '../core/models';
import { SettingsStore } from '../core/settings-store';
import { CUE_TEXT, CueKind, NavRoute, RawCue } from './nav-models';
import { buildRoute } from './route-builder';

interface LatLon {
  lat: number;
  lon: number;
}

interface BrouterResponse {
  features?: { geometry?: { coordinates?: number[][] } }[];
}

interface OsrmStep {
  name?: string;
  maneuver: { type: string; modifier?: string; location: [number, number]; exit?: number };
}
interface OsrmResponse {
  code?: string;
  routes?: { geometry: { coordinates: [number, number][] }; legs: { steps: OsrmStep[] }[] }[];
}

const OSRM_KIND: Record<string, CueKind> = {
  left: 'left',
  right: 'right',
  'slight left': 'slight-left',
  'slight right': 'slight-right',
  'sharp left': 'sharp-left',
  'sharp right': 'sharp-right',
  uturn: 'uturn',
  straight: 'straight',
};

/** Übersetzt einen OSRM-Fahrschritt in einen Hinweis; `null`, wenn nichts anzusagen ist. */
export function osrmCue(step: OsrmStep): RawCue | null {
  const { type, modifier, location, exit } = step.maneuver;
  if (type === 'depart' || type === 'arrive') return null;
  const [lon, lat] = location;
  if (type === 'roundabout' || type === 'rotary') {
    return {
      lat,
      lon,
      kind: 'roundabout',
      text: exit ? `Im Kreisverkehr die ${exit}. Ausfahrt nehmen` : CUE_TEXT.roundabout,
    };
  }
  const kind = OSRM_KIND[modifier ?? ''];
  if (!kind || kind === 'straight') return null;
  // Reiner Namenswechsel mit leichtem Knick ist keine Abbiegung.
  if ((type === 'new name' || type === 'continue') && kind.startsWith('slight')) return null;
  return { lat, lon, kind, text: CUE_TEXT[kind] + (step.name ? ` auf ${step.name}` : '') };
}

/**
 * Berechnet eine Radroute vom Standort zum Ziel.
 * - BRouter: auf Radfahrer zugeschnittene Wege; Hinweise werden aus der Geometrie geschätzt.
 * - OSRM (FOSSGIS): liefert Abbiegungen samt Straßennamen.
 * Fällt der gewählte Dienst aus, wird der andere versucht.
 */
@Injectable({ providedIn: 'root' })
export class RoutePlanner {
  private readonly http = inject(HttpClient);
  private readonly settings = inject(SettingsStore);
  /** Fällt ein Dienst aus, wird der andere versucht; die Meldung kommt erst danach, einmal. */
  private readonly context = new HttpContext().set(SKIP_ERROR_TOAST, true);

  async plan(from: LatLon, to: Place): Promise<NavRoute> {
    const preferred = this.settings.value().routingProvider;
    const order: RoutingProvider[] =
      preferred === 'osrm' ? ['osrm', 'brouter'] : ['brouter', 'osrm'];
    for (const provider of order) {
      try {
        return provider === 'brouter' ? await this.brouter(from, to) : await this.osrm(from, to);
      } catch {
        /* nächsten Dienst versuchen */
      }
    }
    throw new Error(
      navigator.onLine === false
        ? 'Keine Verbindung. Die Routenberechnung braucht Internet.'
        : 'Die Route konnte nicht berechnet werden.',
    );
  }

  private async brouter(from: LatLon, to: Place): Promise<NavRoute> {
    const lonlats = `${from.lon.toFixed(6)},${from.lat.toFixed(6)}%7C${to.lon.toFixed(6)},${to.lat.toFixed(6)}`;
    const profile = this.settings.value().routingProfile;
    const url = `https://brouter.de/brouter?lonlats=${lonlats}&profile=${profile}&alternativeidx=0&format=geojson`;
    const res = await firstValueFrom(
      this.http.get<BrouterResponse>(url, { context: this.context }),
    );
    const coords = res.features?.[0]?.geometry?.coordinates;
    if (!coords?.length) throw new Error('BRouter: leere Antwort');
    return buildRoute(
      to.name,
      coords.map((c): [number, number] => [c[1], c[0]]),
      { destination: to },
    );
  }

  private async osrm(from: LatLon, to: Place): Promise<NavRoute> {
    const coords = `${from.lon.toFixed(6)},${from.lat.toFixed(6)};${to.lon.toFixed(6)},${to.lat.toFixed(6)}`;
    const url = `https://routing.openstreetmap.de/routed-bike/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`;
    const res = await firstValueFrom(this.http.get<OsrmResponse>(url, { context: this.context }));
    const route = res.routes?.[0];
    if (res.code !== 'Ok' || !route) throw new Error('OSRM: keine Route');
    const cues = route.legs
      .flatMap((leg) => leg.steps.map(osrmCue))
      .filter((c): c is RawCue => c != null);
    return buildRoute(
      to.name,
      route.geometry.coordinates.map((c): [number, number] => [c[1], c[0]]),
      { cues, destination: to },
    );
  }
}
