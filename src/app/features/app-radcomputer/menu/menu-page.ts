import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { fmtDistance, fmtTime, num } from '../core/format';
import { Gps } from '../core/gps';
import { RideDisplayState, Settings, SensorState } from '../core/models';
import { RideRecorder } from '../core/ride-recorder';
import { Sensors } from '../core/sensors';
import { SettingsStore } from '../core/settings-store';
import { Strava } from '../core/strava';
import { Toasts } from '../core/toasts';
import { TouchLock } from '../core/touch-lock';
import { RouteGuide } from '../nav/route-guide';
import { WorkoutPlayer } from '../workout/workout-player';
import { RC } from '../core/paths';
import { NavigationService } from '../../../shared/services/navigation-service/navigation-service';

const SENSOR_TEXT: Record<SensorState, string> = {
  off: 'Tippen zum Verbinden',
  busy: 'sucht …',
  on: 'verbunden',
  err: 'Fehler, erneut tippen',
};

const RIDE_STATE_TEXT: Record<RideDisplayState, string> = {
  idle: 'Bereit',
  running: 'Aufnahme läuft',
  auto: 'Auto-Pause',
  paused: 'Pausiert',
};

type DisplayToggle = keyof Pick<Settings, 'showStatusBar' | 'showControls'>;

/** Menü wie am Edge: eine Liste, jeder Eintrag führt auf eine eigene Seite. */
@Component({
  selector: 'rc-menu-page',
  imports: [RouterLink],
  templateUrl: './menu-page.html',
  styleUrl: './menu-page.css',
})
export class MenuPage {
  protected readonly rc = RC;
  protected readonly kudos = inject(NavigationService);
  protected readonly settings = inject(SettingsStore);
  protected readonly sensors = inject(Sensors);
  protected readonly gps = inject(Gps);
  protected readonly strava = inject(Strava);
  protected readonly ride = inject(RideRecorder);
  protected readonly guide = inject(RouteGuide);
  protected readonly player = inject(WorkoutPlayer);
  private readonly toasts = inject(Toasts);
  private readonly router = inject(Router);
  protected readonly lock = inject(TouchLock);

  protected readonly pwrState = this.sensors.state('pwr');
  protected readonly hrState = this.sensors.state('hr');
  protected readonly sensorText = SENSOR_TEXT;

  protected readonly rideState = this.ride.displayState;
  protected readonly rideStateText = computed(() => RIDE_STATE_TEXT[this.ride.displayState()]);
  protected readonly rideTime = computed(() => fmtTime(this.ride.stats().movingMs));
  protected readonly rideKm = computed(() => num(this.ride.stats().distanceM / 1000, 1));

  protected readonly gpsText = computed(() => {
    const acc = this.gps.accuracy();
    if (this.gps.simulated) return 'Demo';
    return this.gps.state() === 'on' && acc != null
      ? `verbunden, ±${Math.round(acc)} m`
      : SENSOR_TEXT[this.gps.state()];
  });
  protected readonly routeText = computed(() => {
    const route = this.guide.route();
    return route
      ? `${route.name}, ${fmtDistance(route.lengthM)}`
      : 'GPX laden, Ziel suchen, Strava-Routen';
  });
  protected readonly workoutText = computed(() => {
    const workout = this.player.workout();
    if (!workout) return 'Trainingsdatei laden';
    return this.player.status() === 'running' ? `${workout.name} läuft` : workout.name;
  });
  protected readonly saveText = computed(() => {
    if (!this.ride.hasData()) return 'Noch nichts aufgezeichnet';
    const stats = this.ride.stats();
    return `${fmtTime(stats.movingMs)}, ${num(stats.distanceM / 1000, 1)} km`;
  });
  protected readonly settingsText = computed(() => {
    return this.strava.canUpload()
      ? 'Datenseiten, Karte, Klingel, Ton, Auto-Pause'
      : 'Strava-Upload freischalten, Datenseiten, Karte, Ton';
  });

  protected toggle(key: DisplayToggle, event: Event): void {
    this.settings.patch({ [key]: (event.target as HTMLInputElement).checked });
  }

  /** Sperren und gleich zurück zur Fahrt: dort will man im Regen hinschauen. */
  protected lockScreen(): void {
    this.lock.lock();
    void this.router.navigateByUrl(RC.ride);
  }

  protected onGps(): void {
    if (this.gps.simulated) this.toasts.show('Demo-Modus: GPS ist simuliert.');
    else this.gps.start();
  }
}
