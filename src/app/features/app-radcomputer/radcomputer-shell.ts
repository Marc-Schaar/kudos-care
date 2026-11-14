import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import { DemoDriver } from './core/demo-driver';
import { fmtDistance, fmtTime } from './core/format';
import { Gps } from './core/gps';
import { RC } from './core/paths';
import { SensorState } from './core/models';
import { RideRecorder } from './core/ride-recorder';
import { RidePageKey, RideView } from './core/ride-view';
import { Sensors } from './core/sensors';
import { SettingsStore } from './core/settings-store';
import { Strava } from './core/strava';
import { Ticker } from './core/ticker';
import { Toasts } from './core/toasts';
import { CueSign } from './nav/cue-sign';
import { CueKind } from './nav/nav-models';
import { RouteGuide } from './nav/route-guide';
import { WorkoutPlayer, describeTarget } from './workout/workout-player';

const SENSOR_TEXT: Record<SensorState, string> = {
  off: 'aus',
  busy: 'sucht',
  on: 'ok',
  err: 'Fehler',
};

interface NavStrip {
  kind: CueKind;
  distance: string;
  text: string;
  off: boolean;
}

/**
 * Rahmen des Radcomputers, aufgebaut wie ein Edge: Sensorleiste oben (ausblendbar), die
 * Fahrtseiten oder das Menü in der Mitte, unten nur Menü, Runde und Start/Pause.
 *
 * Liegt als Vollbild über Kudos Care (Leiste und Fußzeile blendet die Shell von Kudos Care
 * auf diesen Routen aus). Farben und Grundstile gelten nur innerhalb von `.rc`, siehe
 * radcomputer.css.
 */
@Component({
  selector: 'rc-shell',
  imports: [RouterOutlet, RouterLink, CueSign],
  templateUrl: './radcomputer-shell.html',
  styleUrl: './radcomputer-shell.css',
  host: {
    class: 'rc',
    '[attr.data-s]': 'ride.displayState()',
    '[attr.data-theme]': 'settings.value().theme',
  },
})
export class RadcomputerShell {
  protected readonly rc = RC;
  protected readonly ride = inject(RideRecorder);
  protected readonly gps = inject(Gps);
  protected readonly sensors = inject(Sensors);
  protected readonly toasts = inject(Toasts);
  protected readonly settings = inject(SettingsStore);
  private readonly view = inject(RideView);
  private readonly strava = inject(Strava);
  private readonly guide = inject(RouteGuide);
  private readonly player = inject(WorkoutPlayer);
  private readonly ticker = inject(Ticker);
  private readonly router = inject(Router);
  private readonly demo = inject(DemoDriver);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly pwrState = this.sensors.state('pwr');
  protected readonly hrState = this.sensors.state('hr');
  protected readonly pwrText = computed(() => SENSOR_TEXT[this.pwrState()]);
  protected readonly hrText = computed(() => SENSOR_TEXT[this.hrState()]);
  protected readonly gpsText = computed(() => {
    const acc = this.gps.accuracy();
    return this.gps.state() === 'on' && acc != null
      ? `±${Math.round(acc)} m`
      : SENSOR_TEXT[this.gps.state()];
  });
  protected readonly clock = computed(() =>
    new Date(this.ticker.now()).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
  );
  protected readonly mainLabel = computed(() => {
    const status = this.ride.status();
    return status === 'running' ? 'Pause' : 'Start';
  });

  protected readonly onRide = computed(() => this.url().startsWith(RC.ride));
  /** Ausgeblendete Leiste: nur auf der Fahrt, und nach einem Tipp kurz über dem Inhalt. */
  protected readonly controlsFloating = computed(
    () => this.onRide() && !this.settings.value().showControls,
  );
  protected readonly controlsVisible = computed(
    () => !this.controlsFloating() || this.view.revealed(),
  );

  /** Nächster Abbiegehinweis, sichtbar überall außer auf der Kartenseite. */
  protected readonly navStrip = computed<NavStrip | null>(() => {
    const p = this.guide.progress();
    if (!p || (this.onRide() && this.view.page() === 'map')) return null;
    if (p.offRoute)
      return { kind: 'uturn', distance: fmtDistance(p.offM), text: 'Route verlassen', off: true };
    if (!p.nextCue || p.cueDistM == null) return null;
    return {
      kind: p.nextCue.kind,
      distance: fmtDistance(p.cueDistM),
      text: p.arrived ? 'Ziel erreicht' : p.nextCue.text,
      off: false,
    };
  });

  /** Laufender Trainingsschritt, sichtbar überall außer auf der Trainingsseite. */
  protected readonly workoutStrip = computed(() => {
    const step = this.player.step();
    if (
      !step ||
      this.player.status() !== 'running' ||
      (this.onRide() && this.view.page() === 'workout')
    )
      return null;
    return {
      remaining: fmtTime(this.player.stepRemainingS() * 1000),
      text: `${step.label}, ${describeTarget(step)}`,
    };
  });

  constructor() {
    this.demo.start();
    this.strava.check();
    // Solange der Radcomputer offen ist, soll die Seite darunter nicht mitscrollen oder federn.
    const body = inject(DOCUMENT).body;
    body.classList.add('rc-active');
    inject(DestroyRef).onDestroy(() => body.classList.remove('rc-active'));
  }

  protected openRidePage(page: RidePageKey): void {
    this.view.show(page);
    void this.router.navigateByUrl(RC.ride);
  }

  /**
   * Stop beendet nicht sofort: Die Fahrt bleibt pausiert, bis sie hochgeladen oder exportiert
   * ist. Wer sich vertippt hat, fährt mit „Weiter“ einfach fort, es geht nichts verloren.
   */
  protected stop(): void {
    this.ride.persist();
    void this.router.navigateByUrl(RC.save);
  }

  /** Solange man die Leiste benutzt, bleibt sie stehen. */
  protected onControlsClick(): void {
    if (this.controlsFloating()) this.view.reveal();
  }

  protected onGps(): void {
    if (this.gps.simulated) this.toasts.show('Demo-Modus: GPS ist simuliert.');
    else if (this.gps.state() === 'on') this.toasts.show(`GPS-Genauigkeit: ${this.gpsText()}`);
    else this.gps.start();
  }
}
