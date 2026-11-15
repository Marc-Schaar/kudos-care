import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../../../core/interceptors/error-interceptor/error-interceptor';
import { StravaService } from '../../../shared/services/strava-service/strava-service';
import { angleDiff, haversine } from './geo';
import { Gps } from './gps';
import { Ticker } from './ticker';

/** Antwort von GET /api/radcomputer/wind/ */
export interface WindReading {
  speed_kmh: number;
  gusts_kmh: number | null;
  /** Meteorologisch: Richtung, AUS der der Wind kommt, 0 = Norden */
  direction_deg: number;
  observed_at: string | null;
  lat: number;
  lon: number;
}

/**
 * off      noch keine Position (oder Radcomputer zu)
 * consent  keine Einwilligung: es geht nichts an Open-Meteo
 * loading  erste Abfrage läuft
 * ok       frischer Wert liegt vor
 * offline  kein Netz, ein älterer Wert kann noch stehen
 * error    Dienst nicht erreichbar
 */
export type WindState = 'off' | 'consent' | 'loading' | 'ok' | 'offline' | 'error';

/** Wind aus Sicht des Fahrers. */
export interface RelativeWind {
  /** Anteil gegen die Fahrtrichtung in km/h: positiv = Gegenwind, negativ = Rückenwind */
  head: number;
  /** Anteil quer: positiv = von rechts */
  cross: number;
  /** Woher der Wind kommt, relativ zur Fahrtrichtung: 0 = von vorn, 90 = von rechts */
  fromDeg: number;
  kind: WindKind;
}

export type WindKind = 'head' | 'tail' | 'cross';

/** Neu abfragen nach dieser Zeit oder Strecke. Open-Meteo rechnet alle 15 Minuten neu. */
const REFRESH_MS = 10 * 60_000;
const REFRESH_M = 5000;
/** Nach einem Fehlschlag frühestens dann wieder. */
const RETRY_MS = 2 * 60_000;
/** Älter wird nicht mehr angezeigt: der Wind kann sich gedreht haben. */
const SHOW_MAX_MS = 30 * 60_000;
/**
 * Unterhalb dieses Anteils der Windstärke zählt der Wind als Seitenwind: Bei 60° von vorn
 * ist cos = 0,5, das spürt man als Gegenwind; bei 70° kaum noch.
 */
const CROSS_SHARE = 0.4;

/**
 * Zerlegt den Wind in Gegen- und Seitenanteil. Dieselbe Konvention wie
 * `app_dashboard/api/wind.py` im Backend: positiv = Gegenwind.
 */
export function relativeWind(fromDeg: number, speedKmh: number, headingDeg: number): RelativeWind {
  const rel = angleDiff(headingDeg, fromDeg);
  const rad = (rel * Math.PI) / 180;
  const head = speedKmh * Math.cos(rad);
  const cross = speedKmh * Math.sin(rad);
  const kind: WindKind =
    Math.abs(head) < speedKmh * CROSS_SHARE || speedKmh < 1 ? 'cross' : head > 0 ? 'head' : 'tail';
  return { head, cross, fromDeg: (rel + 360) % 360, kind };
}

const COMPASS = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];

/** „SW“ für 225°: Himmelsrichtung, aus der der Wind kommt. */
export function compassPoint(deg: number): string {
  return COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

/** Beaufort-Wort für die Ansage auf der Kachel. */
export function windWord(kmh: number): string {
  if (kmh < 6) return 'still';
  if (kmh < 12) return 'schwach';
  if (kmh < 20) return 'mäßig';
  if (kmh < 29) return 'frisch';
  if (kmh < 39) return 'stark';
  return 'stürmisch';
}

/**
 * Aktueller Wind am Standort, über das Kudos-Backend (Open-Meteo). Fragt nur, solange der
 * Radcomputer offen ist, eine Position vorliegt und die Wetter-Einwilligung erteilt ist.
 */
@Injectable({ providedIn: 'root' })
export class Wind {
  private readonly http = inject(HttpClient);
  private readonly gps = inject(Gps);
  private readonly ticker = inject(Ticker);
  private readonly kudos = inject(StravaService);
  private readonly url = `${environment.apiUrl}/radcomputer/wind/`;

  private active = false;
  private inflight = false;
  private lastAttemptAt = 0;

  /** Im Demo-Modus kommt der Wind aus der Simulation. */
  simulated = false;

  readonly state = signal<WindState>('off');
  readonly reading = signal<WindReading | null>(null);
  readonly fetchedAt = signal(0);

  readonly consent = computed(() => this.kudos.user()?.weather_consent === true);

  /** Der Wert, solange er nicht zu alt ist. */
  readonly current = computed(() => {
    const reading = this.reading();
    return reading && this.ticker.now() - this.fetchedAt() < SHOW_MAX_MS ? reading : null;
  });

  /** Wind relativ zur Fahrtrichtung; ohne Kurs (noch nicht losgefahren) `null`. */
  readonly relative = computed<RelativeWind | null>(() => {
    const wind = this.current();
    const heading = this.gps.heading();
    return wind && heading != null
      ? relativeWind(wind.direction_deg, wind.speed_kmh, heading)
      : null;
  });

  constructor() {
    this.ticker.onTick((now) => this.maybeFetch(now));
  }

  /** Solange der Radcomputer offen ist. */
  setActive(active: boolean): void {
    this.active = active;
    if (active) this.maybeFetch(Date.now());
  }

  /** Demo-Modus: fester Wind ohne Netz. */
  simulate(reading: WindReading): void {
    this.simulated = true;
    this.reading.set(reading);
    this.fetchedAt.set(Date.now());
    this.state.set('ok');
  }

  /** Sofort neu abfragen, etwa nach dem Erteilen der Einwilligung. */
  refresh(): void {
    this.lastAttemptAt = 0;
    this.fetchedAt.set(0);
    this.maybeFetch(Date.now());
  }

  private maybeFetch(now: number): void {
    if (this.simulated) {
      // Simulierter Wert veraltet nicht.
      this.fetchedAt.set(now);
      return;
    }
    if (!this.active || this.inflight) return;
    if (!this.consent()) {
      // Nach einem Widerruf auch nichts Altes mehr zeigen.
      this.reading.set(null);
      this.state.set('consent');
      return;
    }
    const pos = this.gps.position();
    if (!pos) {
      if (!this.reading()) this.state.set('off');
      return;
    }
    const last = this.reading();
    const due =
      !last ||
      now - this.fetchedAt() >= REFRESH_MS ||
      haversine(last.lat, last.lon, pos.lat, pos.lon) >= REFRESH_M;
    if (!due || now - this.lastAttemptAt < RETRY_MS) return;
    void this.fetch(pos.lat, pos.lon, now);
  }

  private async fetch(lat: number, lon: number, now: number): Promise<void> {
    this.inflight = true;
    this.lastAttemptAt = now;
    if (!this.reading()) this.state.set('loading');
    try {
      const reading = await firstValueFrom(
        this.http.get<WindReading>(this.url, {
          // Auf ~1 km gerundet, genauer braucht es das Wettermodell nicht.
          params: { lat: lat.toFixed(2), lon: lon.toFixed(2) },
          context: new HttpContext().set(SKIP_ERROR_TOAST, true),
        }),
      );
      this.reading.set(reading);
      this.fetchedAt.set(Date.now());
      this.state.set('ok');
    } catch (err) {
      const status = err instanceof HttpErrorResponse ? err.status : -1;
      if (status === 403) {
        // Einwilligung inzwischen widerrufen: neu laden, damit `consent` stimmt.
        this.kudos.fetchUser().subscribe({ error: () => undefined });
        this.state.set('consent');
      } else {
        this.state.set(status === 0 ? 'offline' : 'error');
      }
    } finally {
      this.inflight = false;
    }
  }
}
