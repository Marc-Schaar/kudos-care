import { Component, computed, inject, signal } from '@angular/core';
import { FormField, form, max, min, required } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';

import { StravaService } from '../../../shared/services/strava-service/strava-service';
import { AudioFeedback } from '../core/audio-feedback';
import { clamp } from '../core/format';
import { Heading } from '../core/heading';
import { AudioMode, MapStyle, RoutingProfile, RoutingProvider, Settings } from '../core/models';
import { RC } from '../core/paths';
import { ScreenWake } from '../core/screen-wake';
import { Sensors } from '../core/sensors';
import { DEFAULT_SETTINGS, SettingsStore } from '../core/settings-store';
import { Strava } from '../core/strava';
import { Toasts } from '../core/toasts';
import { Wind } from '../core/wind';
import { effectivePages } from '../ride/fields';
import { SubHeader } from './sub-header';

/** Eine Option einer Schildleiste: kurzer Name auf der Taste, Erklärung darunter. */
interface Choice<T extends string> {
  value: T;
  label: string;
  hint: string;
}

/** Zahlenfeld mit Stepper: Grenzen wie im Formular, Schritt je Tipp. */
interface Range {
  min: number;
  max: number;
  step: number;
}

const FTP: Range = { min: 50, max: 600, step: 5 };
const AUTO_PAUSE: Range = { min: 0.5, max: 20, step: 0.5 };

@Component({
  selector: 'rc-settings-page',
  imports: [FormField, SubHeader, RouterLink],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.css',
})
export class SettingsPage {
  protected readonly settings = inject(SettingsStore);
  protected readonly strava = inject(Strava);
  protected readonly wake = inject(ScreenWake);
  protected readonly sensors = inject(Sensors);
  protected readonly audio = inject(AudioFeedback);
  private readonly toasts = inject(Toasts);
  private readonly kudos = inject(StravaService);
  protected readonly wind = inject(Wind);
  protected readonly heading = inject(Heading);
  protected readonly rc = RC;
  protected readonly saving = signal(false);
  protected readonly ftpRange = FTP;
  protected readonly autoPauseRange = AUTO_PAUSE;

  // Je Leiste steht nur die Erklärung der gewählten Option da, nicht alle drei auf einmal.
  protected readonly audioChoices: Choice<AudioMode>[] = [
    { value: 'speech', label: 'Sprache', hint: 'Abbiegen, Runden und Ziele werden angesagt.' },
    { value: 'beep', label: 'Töne', hint: 'Nur Signaltöne, keine Ansagen.' },
    { value: 'off', label: 'Aus', hint: 'Kein Ton. Hinweise erscheinen nur auf dem Display.' },
  ];
  protected readonly mapStyleChoices: Choice<MapStyle>[] = [
    { value: 'cyclosm', label: 'CyclOSM', hint: 'Zeigt Radwege, Belag und Radinfrastruktur.' },
    { value: 'topo', label: 'Topo', hint: 'Mit Höhenlinien, für Gravel und Gelände.' },
    { value: 'osm', label: 'OSM', hint: 'Die Standardkarte von OpenStreetMap.' },
  ];
  protected readonly providerChoices: Choice<RoutingProvider>[] = [
    { value: 'brouter', label: 'BRouter', hint: 'Plant über Radwege und ruhige Straßen.' },
    { value: 'osrm', label: 'OSRM', hint: 'Sagt beim Abbiegen die Straßennamen an.' },
  ];
  protected readonly profileChoices: Choice<RoutingProfile>[] = [
    { value: 'trekking', label: 'Trekking', hint: 'Ruhige Wege, auch unbefestigt.' },
    { value: 'fastbike', label: 'Rennrad', hint: 'Schnell und auf Asphalt.' },
  ];

  protected readonly pagesText = computed(() => {
    const pages = effectivePages(this.settings.value().dataPages);
    const names = pages.map((p) => p.name).join(', ');
    return this.settings.value().dataPages.length ? names : `Standard: ${names}`;
  });

  /** Das Formular schreibt direkt in die Einstellungen; der Speicher sichert jede Änderung. */
  protected readonly form = form(this.settings.value, (path) => {
    required(path.ftp, { message: 'Bitte deine FTP eintragen.' });
    min(path.ftp, FTP.min, { message: `Mindestens ${FTP.min} W.` });
    max(path.ftp, FTP.max, { message: `Höchstens ${FTP.max} W.` });
    required(path.autoPauseKmh, { message: 'Bitte eine Geschwindigkeit eintragen.' });
    min(path.autoPauseKmh, AUTO_PAUSE.min, { message: 'Mindestens 0,5 km/h.' });
    max(path.autoPauseKmh, AUTO_PAUSE.max, { message: `Höchstens ${AUTO_PAUSE.max} km/h.` });
  });

  protected hintFor<T extends string>(choices: Choice<T>[], value: T): string {
    return choices.find((c) => c.value === value)?.hint ?? '';
  }

  protected pick<K extends keyof Settings>(key: K, value: Settings[K]): void {
    this.settings.patch({ [key]: value } as Partial<Settings>);
  }

  /**
   * Stepper neben den Zahlenfeldern: mit Handschuhen trifft man die Tasten, nicht die
   * Bildschirmtastatur. Ein leeres Feld startet beim Standardwert, ein krummer Wert rastet
   * auf den nächsten Schritt ein.
   */
  protected step(key: 'ftp' | 'autoPauseKmh', direction: 1 | -1): void {
    const range = key === 'ftp' ? FTP : AUTO_PAUSE;
    const current = this.settings.value()[key] ?? DEFAULT_SETTINGS[key] ?? range.min;
    const snapped = Math.round(current / range.step) * range.step;
    const next = snapped === current ? current + direction * range.step : snapped;
    this.pick(key, clamp(Math.round(next * 10) / 10, range.min, range.max));
  }

  protected atLimit(key: 'ftp' | 'autoPauseKmh', direction: 1 | -1): boolean {
    const range = key === 'ftp' ? FTP : AUTO_PAUSE;
    const v = this.settings.value()[key];
    if (v == null) return false;
    return direction < 0 ? v <= range.min : v >= range.max;
  }

  /** Einwilligung wie im Kudos-Menü, siehe `app_auth/consent.py` im Backend. */
  protected setWeatherConsent(enabled: boolean): void {
    this.saving.set(true);
    this.kudos.updateSettings({ weather_consent: enabled }).subscribe({
      next: () => {
        this.saving.set(false);
        this.toasts.show(enabled ? 'Wetterdaten erlaubt.' : 'Wetterdaten nicht mehr erlaubt.');
        if (enabled) this.wind.refresh();
      },
      error: () => {
        this.saving.set(false);
        this.toasts.show('Einstellung konnte nicht gespeichert werden.');
      },
    });
  }

  protected testBell(): void {
    this.audio.bell();
  }

  protected testAudio(): void {
    this.audio.unlock();
    if (this.settings.value().audio === 'off') this.toasts.show('Der Ton ist ausgeschaltet.');
    else this.audio.say('So klingen die Ansagen.');
  }
}
