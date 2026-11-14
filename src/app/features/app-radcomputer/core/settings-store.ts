import { Injectable, computed, effect, signal } from '@angular/core';

import { clamp } from './format';
import { Settings } from './models';
import { store } from './storage';

const KEY = 'radcomputer.settings.v2';

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
};

function load(): Settings {
  // Ältere Stände hatten noch Backend-Adresse und Token; die braucht es in Kudos Care nicht mehr.
  const saved =
    store.get<Partial<Settings> & { backendUrl?: string; backendToken?: string }>(KEY) ?? {};
  delete saved.backendUrl;
  delete saved.backendToken;
  return { ...DEFAULT_SETTINGS, ...saved };
}

@Injectable({ providedIn: 'root' })
export class SettingsStore {
  /** Dient zugleich als Modell des Einstellungsformulars. */
  readonly value = signal<Settings>(load());

  // Bereinigte Werte: Das Formular darf vorübergehend leere oder unsinnige Zahlen enthalten.
  readonly ftp = computed(() => clamp(this.value().ftp ?? DEFAULT_SETTINGS.ftp!, 50, 600));
  /** Auto-Pause-Schwelle in m/s */
  readonly autoPauseSpeed = computed(
    () => clamp(this.value().autoPauseKmh ?? DEFAULT_SETTINGS.autoPauseKmh!, 0.5, 20) / 3.6,
  );

  constructor() {
    // Das Farbthema setzt der Rahmen (radcomputer-shell) auf sich selbst, nicht aufs Dokument:
    // Kudos Care hat eigene Farben.
    effect(() => store.set(KEY, this.value()));
  }

  patch(part: Partial<Settings>): void {
    this.value.update((v) => ({ ...v, ...part }));
  }
}
