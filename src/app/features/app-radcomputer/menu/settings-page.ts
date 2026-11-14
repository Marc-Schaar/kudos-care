import { Component, inject } from '@angular/core';
import { FormField, form, max, min, required } from '@angular/forms/signals';

import { AudioFeedback } from '../core/audio-feedback';
import { ScreenWake } from '../core/screen-wake';
import { Sensors } from '../core/sensors';
import { SettingsStore } from '../core/settings-store';
import { Strava } from '../core/strava';
import { Toasts } from '../core/toasts';
import { SubHeader } from './sub-header';

@Component({
  selector: 'rc-settings-page',
  imports: [FormField, SubHeader],
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

  /** Das Formular schreibt direkt in die Einstellungen; der Speicher sichert jede Änderung. */
  protected readonly form = form(this.settings.value, (path) => {
    required(path.ftp, { message: 'Bitte deine FTP eintragen.' });
    min(path.ftp, 50, { message: 'Mindestens 50 W.' });
    max(path.ftp, 600, { message: 'Höchstens 600 W.' });
    required(path.autoPauseKmh, { message: 'Bitte eine Geschwindigkeit eintragen.' });
    min(path.autoPauseKmh, 0.5, { message: 'Mindestens 0,5 km/h.' });
    max(path.autoPauseKmh, 20, { message: 'Höchstens 20 km/h.' });
  });

  protected testAudio(): void {
    this.audio.unlock();
    if (this.settings.value().audio === 'off') this.toasts.show('Der Ton ist ausgeschaltet.');
    else this.audio.say('So klingen die Ansagen.');
  }
}
