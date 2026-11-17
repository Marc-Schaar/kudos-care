import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../../../core/interceptors/error-interceptor/error-interceptor';
import { clamp } from './format';
import { Settings } from './models';
import { store } from './storage';

const KEY = 'radcomputer.settings.v2';
/** Wartezeit nach der letzten Änderung, bevor gespeichert wird: Zahlenfelder ändern sich je Taste. */
const SAVE_DELAY_MS = 800;

export const DEFAULT_SETTINGS: Settings = {
  theme: 'night',
  autoPause: true,
  autoPauseKmh: 3,
  autoPauseInWorkout: true,
  ftp: 200,
  audio: 'speech',
  powerAlerts: true,
  lapAnnouncements: true,
  mapTiles: true,
  headingUp: true,
  routingProvider: 'brouter',
  routingProfile: 'trekking',
  showStatusBar: true,
  showControls: true,
  bellButton: true,
  mapStyle: 'cyclosm',
  dataPages: [],
};

/** Feldnamen im Frontend ↔ in der API (GET|PUT /api/radcomputer/settings/). */
const API_FIELDS: Record<keyof Settings, string> = {
  theme: 'theme',
  autoPause: 'auto_pause',
  autoPauseKmh: 'auto_pause_kmh',
  autoPauseInWorkout: 'auto_pause_in_workout',
  ftp: 'ftp',
  audio: 'audio',
  powerAlerts: 'power_alerts',
  lapAnnouncements: 'lap_announcements',
  mapTiles: 'map_tiles',
  headingUp: 'heading_up',
  routingProvider: 'routing_provider',
  routingProfile: 'routing_profile',
  showStatusBar: 'show_status_bar',
  showControls: 'show_controls',
  bellButton: 'bell_button',
  mapStyle: 'map_style',
  dataPages: 'data_pages',
};

type ApiSettings = Record<string, unknown> & { stored?: boolean };

function load(): Settings {
  // Ältere Stände hatten noch Backend-Adresse und Token; die braucht es in Kudos Care nicht mehr.
  const saved =
    store.get<Partial<Settings> & { backendUrl?: string; backendToken?: string }>(KEY) ?? {};
  delete saved.backendUrl;
  delete saved.backendToken;
  return { ...DEFAULT_SETTINGS, ...saved };
}

function fromApi(body: ApiSettings): Partial<Settings> {
  const out: Partial<Record<keyof Settings, unknown>> = {};
  for (const [key, field] of Object.entries(API_FIELDS) as [keyof Settings, string][]) {
    if (body[field] !== undefined) out[key] = body[field];
  }
  return out as Partial<Settings>;
}

/**
 * Einstellungen des Radcomputers. Maßgeblich ist das Kudos-Konto (die Werte folgen auf jedes
 * Gerät); der localStorage hält eine Kopie, damit der Radcomputer auch ohne Netz sofort mit
 * den letzten Werten startet.
 */
@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/radcomputer/settings/`;
  private readonly context = new HttpContext().set(SKIP_ERROR_TOAST, true);

  /** Dient zugleich als Modell des Einstellungsformulars. */
  readonly value = signal<Settings>(load());

  // Bereinigte Werte: Das Formular darf vorübergehend leere oder unsinnige Zahlen enthalten.
  readonly ftp = computed(() => clamp(this.value().ftp ?? DEFAULT_SETTINGS.ftp!, 50, 600));
  /** Auto-Pause-Schwelle in m/s */
  readonly autoPauseSpeed = computed(
    () => clamp(this.value().autoPauseKmh ?? DEFAULT_SETTINGS.autoPauseKmh!, 0.5, 20) / 3.6,
  );

  /** Erst nach dem ersten Abgleich mit dem Konto speichern, sonst überschreibt ein altes Gerät die Werte. */
  private readonly loaded = signal(false);
  /** Zuletzt gesendeter Stand, damit übernommene Serverwerte nicht gleich zurückgeschickt werden. */
  private lastSent = '';
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // Das Farbthema setzt der Rahmen (radcomputer-shell) auf sich selbst, nicht aufs Dokument:
    // Kudos Care hat eigene Farben.
    effect(() => store.set(KEY, this.value()));
    effect(() => {
      const body = this.toApi();
      if (!this.loaded()) return;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => void this.save(body), SAVE_DELAY_MS);
    });
    void this.fetch();
  }

  patch(part: Partial<Settings>): void {
    this.value.update((v) => ({ ...v, ...part }));
  }

  private async fetch(): Promise<void> {
    try {
      const body = await firstValueFrom(
        this.http.get<ApiSettings>(this.url, { context: this.context }),
      );
      if (body.stored) {
        this.value.update((v) => ({ ...v, ...fromApi(body) }));
        this.lastSent = JSON.stringify(this.toApi());
      }
      // Ohne gespeicherte Werte schickt der erste Durchlauf des Effekts die lokalen Werte
      // hoch: so wandern die bisher nur im Browser gespeicherten Einstellungen ins Konto.
    } catch {
      // Offline: mit den lokalen Werten weiter; die nächste Änderung versucht es erneut.
    } finally {
      this.loaded.set(true);
    }
  }

  private async save(body: Record<string, unknown>): Promise<void> {
    const json = JSON.stringify(body);
    if (json === this.lastSent) return;
    try {
      await firstValueFrom(this.http.put(this.url, body, { context: this.context }));
      this.lastSent = json;
    } catch {
      // Bleibt lokal gespeichert und geht mit der nächsten Änderung mit.
    }
  }

  /** Bereinigte Werte im API-Format; die Zahlenfelder als die tatsächlich wirksamen Werte. */
  private toApi(): Record<string, unknown> {
    const v = this.value();
    const out: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(API_FIELDS) as [keyof Settings, string][]) {
      out[field] = v[key];
    }
    out['ftp'] = this.ftp();
    out['auto_pause_kmh'] = Math.round(this.autoPauseSpeed() * 3.6 * 10) / 10;
    return out;
  }
}
