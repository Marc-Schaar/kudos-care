import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

import { NavRoute } from '../nav/nav-models';
import { buildRoute } from '../nav/route-builder';
import { RouteGuide } from '../nav/route-guide';
import { makeWorkout } from '../workout/workout-models';
import { WorkoutPlayer } from '../workout/workout-player';
import { AudioFeedback } from './audio-feedback';
import { bearing } from './geo';
import { Gps } from './gps';
import { RideRecorder } from './ride-recorder';
import { Sensors } from './sensors';
import { SettingsStore } from './settings-store';
import { buildTcx } from './tcx';

const M_PER_DEG_LAT = 111320;

/**
 * Demo-Modus (Adresse mit `?demo`): simuliert GPS, Powermeter und Pulsgurt, damit sich
 * die App am Schreibtisch ausprobieren und automatisch testen lässt. Die simulierte
 * Fahrt folgt einer geladenen Route und trifft die Zielleistung eines laufenden Trainings.
 */
@Injectable({ providedIn: 'root' })
export class DemoDriver {
  private readonly doc = inject(DOCUMENT);
  private readonly gps = inject(Gps);
  private readonly sensors = inject(Sensors);
  private readonly ride = inject(RideRecorder);
  private readonly guide = inject(RouteGuide);
  private readonly player = inject(WorkoutPlayer);
  private readonly audio = inject(AudioFeedback);
  private readonly settings = inject(SettingsStore);

  readonly active = new URLSearchParams(this.doc.location.search).has('demo');

  /** Tempo in m/s. Auf 0 gesetzt, löst es die Auto-Pause aus. */
  speed = 8.9;
  /** Seitlicher Versatz zur Route in Metern: simuliert „Route verlassen“. */
  offsetM = 0;

  private lat = 51.0;
  private lon = 7.0;
  private alt = 120;
  private alongM = 0;
  private segment = 0;
  private startedAt = 0;
  private revs = 0;
  private lastCrank = 0;
  private nextCrank = 0;

  start(): void {
    if (!this.active) return;
    this.gps.simulated = true;
    this.sensors.simulated = true;
    this.sensors.setState('pwr', 'on');
    this.sensors.setState('hr', 'on');
    this.startedAt = Date.now();
    setInterval(() => this.step(), 1000);
    // Zugriff für automatische Tests und zum Ausprobieren in der Konsole.
    Object.assign(this.doc.defaultView ?? {}, {
      __rc: {
        demo: this,
        ride: this.ride,
        guide: this.guide,
        player: this.player,
        audio: this.audio,
        settings: this.settings,
        gps: this.gps,
        sensors: this.sensors,
        buildTcx,
      },
    });
  }

  /** Kurze Zickzack-Strecke mit vier Abbiegungen. */
  loadSampleRoute(): void {
    const mPerDegLon = M_PER_DEG_LAT * Math.cos((51 * Math.PI) / 180);
    const legs: [number, number][] = [
      [0, 400],
      [300, 0],
      [0, 300],
      [-200, 0],
      [0, 300],
    ]; // [Ost, Nord] in Metern
    const coords: [number, number][] = [[51.0, 7.0]];
    let east = 0;
    let north = 0;
    for (const [dE, dN] of legs) {
      const steps = Math.round(Math.hypot(dE, dN) / 10);
      for (let i = 1; i <= steps; i++) {
        coords.push([
          51.0 + (north + (dN * i) / steps) / M_PER_DEG_LAT,
          7.0 + (east + (dE * i) / steps) / mPerDegLon,
        ]);
      }
      east += dE;
      north += dN;
    }
    this.alongM = 0;
    this.segment = 0;
    this.offsetM = 0;
    this.guide.setRoute(buildRoute('Beispielroute', coords));
  }

  /** Kurzes Training mit Rampe und zwei Intervallen: in gut einer Minute durch. */
  loadSampleWorkout(): void {
    this.player.load(
      makeWorkout('Beispieltraining', [
        { label: 'Einfahren', durationS: 15, fromW: 100, toW: 150 },
        { label: 'Belastung 1 von 2', durationS: 15, fromW: 250, toW: 250 },
        { label: 'Erholung 1 von 2', durationS: 10, fromW: 120, toW: 120 },
        { label: 'Belastung 2 von 2', durationS: 15, fromW: 250, toW: 250 },
        { label: 'Ausfahren', durationS: 10, fromW: 140, toW: 90 },
      ]),
    );
  }

  private step(): void {
    const now = Date.now();
    const t = (now - this.startedAt) / 1000;
    const route = this.guide.route();
    let v = this.speed <= 0 ? 0 : this.speed + Math.sin(t / 7) * 0.8;
    let heading: number | null = 0;

    if (route) {
      if (this.alongM >= route.lengthM) v = 0;
      this.alongM = Math.min(route.lengthM, this.alongM + v);
      const pos = this.pointAt(route, this.alongM);
      // Versatz quer zur Fahrtrichtung, nach rechts.
      const side = ((pos.heading + 90) * Math.PI) / 180;
      this.lat = pos.lat + (this.offsetM * Math.cos(side)) / M_PER_DEG_LAT;
      this.lon =
        pos.lon +
        (this.offsetM * Math.sin(side)) / (M_PER_DEG_LAT * Math.cos((pos.lat * Math.PI) / 180));
      heading = pos.heading;
    } else {
      this.lat += v / M_PER_DEG_LAT;
    }
    this.alt += Math.sin(t / 20) * 0.4;
    this.gps.feed({
      lat: this.lat,
      lon: this.lon,
      alt: this.alt,
      acc: 5,
      altAcc: 4,
      speed: v,
      heading: v > 0 ? heading : null,
      t: now,
    });

    // Leistung: Zielwert des laufenden Trainings treffen, sonst gleichmäßig rollen.
    const target = this.player.status() === 'running' ? this.player.targetW() : null;
    const watts =
      v > 0 ? Math.round((target ?? 190) + Math.sin(t / 3) * (target == null ? 25 : 6)) : 0;
    const cadence = v > 0 ? 88 + Math.sin(t / 5) * 4 : 0;
    if (cadence > 0) {
      while (this.nextCrank <= t) {
        this.revs = (this.revs + 1) & 0xffff;
        this.lastCrank = this.nextCrank;
        this.nextCrank += 60 / cadence;
      }
    } else {
      this.nextCrank = t + 0.5;
    }
    const power = new DataView(new ArrayBuffer(8));
    power.setUint16(0, 0x0020, true); // Flag: Kurbeldaten folgen
    power.setInt16(2, watts, true);
    power.setUint16(4, this.revs, true);
    power.setUint16(6, Math.round(this.lastCrank * 1024) & 0xffff, true);
    this.sensors.handlePower(power);

    const hr = new DataView(new ArrayBuffer(2));
    hr.setUint8(0, 0);
    hr.setUint8(1, Math.round(146 + Math.sin(t / 11) * 5));
    this.sensors.handleHeartRate(hr);
  }

  private pointAt(route: NavRoute, along: number): { lat: number; lon: number; heading: number } {
    const pts = route.points;
    if (this.segment > pts.length - 2 || pts[this.segment].dist > along) this.segment = 0;
    while (this.segment < pts.length - 2 && pts[this.segment + 1].dist < along) this.segment++;
    const a = pts[this.segment];
    const b = pts[this.segment + 1];
    const f = b.dist > a.dist ? Math.min(1, Math.max(0, (along - a.dist) / (b.dist - a.dist))) : 0;
    return {
      lat: a.lat + (b.lat - a.lat) * f,
      lon: a.lon + (b.lon - a.lon) * f,
      heading: bearing(a.lat, a.lon, b.lat, b.lon),
    };
  }
}
