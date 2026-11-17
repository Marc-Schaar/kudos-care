import { Component, computed, inject, signal } from '@angular/core';
import { FormField, form, max, min, required } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';

import { StravaService } from '../../../shared/services/strava-service/strava-service';
import { AudioFeedback } from '../core/audio-feedback';
import { Heading } from '../core/heading';
import { RC } from '../core/paths';
import { ScreenWake } from '../core/screen-wake';
import { Sensors } from '../core/sensors';
import { SettingsStore } from '../core/settings-store';
import { Strava } from '../core/strava';
import { Toasts } from '../core/toasts';
import { Wind } from '../core/wind';
import { effectivePages } from '../ride/fields';
import { SubHeader } from './sub-header';

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

  protected readonly pagesText = computed(() => {
    const pages = effectivePages(this.settings.value().dataPages);
    const names = pages.map((p) => p.name).join(', ');
    return this.settings.value().dataPages.length ? names : `Standard: ${names}`;
  });

  /** Einwilligung wie im Kudos-Menü, siehe `app_auth/consent.py` im Backend. */
  protected setWeatherConsent(enabled: boolean): void {
    this.saving.set(true);
    this.kudos.updateSettings({ weather_consent: enabled }).subscribe({
      next: () => {
        this.saving.set(false);
        this.toasts.show(enabled ? 'Wetterdaten freigegeben.' : 'Freigabe widerrufen.');
        if (enabled) this.wind.refresh();
      },
      error: () => {
        this.saving.set(false);
        this.toasts.show('Einstellung konnte nicht gespeichert werden.');
      },
    });
  }

  /** Das Formular schreibt direkt in die Einstellungen; der Speicher sichert jede Änderung. */
  protected readonly form = form(this.settings.value, (path) => {
    required(path.ftp, { message: 'Bitte deine FTP eintragen.' });
    min(path.ftp, 50, { message: 'Mindestens 50 W.' });
    max(path.ftp, 600, { message: 'Höchstens 600 W.' });
    required(path.autoPauseKmh, { message: 'Bitte eine Geschwindigkeit eintragen.' });
    min(path.autoPauseKmh, 0.5, { message: 'Mindestens 0,5 km/h.' });
    max(path.autoPauseKmh, 20, { message: 'Höchstens 20 km/h.' });
  });

  protected testBell(): void {
    this.audio.bell();
  }

  protected testAudio(): void {
    this.audio.unlock();
    if (this.settings.value().audio === 'off') this.toasts.show('Der Ton ist ausgeschaltet.');
    else this.audio.say('So klingen die Ansagen.');
  }
}
