import { Injectable, computed, inject, signal } from '@angular/core';

import { bearing, haversine } from './geo';
import { GpsFix, SensorState } from './models';
import { Ticker } from './ticker';
import { Toasts } from './toasts';

const STALE_MS = 4000;
/** Ungenauere Positionen zeigen wir an, rechnen aber nicht damit. */
const MAX_ACCURACY_M = 30;

type FixListener = (fix: GpsFix) => void;

@Injectable({ providedIn: 'root' })
export class Gps {
  private readonly ticker = inject(Ticker);
  private readonly toasts = inject(Toasts);
  private readonly listeners: FixListener[] = [];
  private watchId: number | null = null;
  private lastAnyAt = 0;

  /** Im Demo-Modus kommen die Positionen aus der Simulation. */
  simulated = false;

  readonly state = signal<SensorState>('off');
  readonly accuracy = signal<number | null>(null);
  /** Letzte brauchbare Position, mit ergänzter Geschwindigkeit und Kursrichtung. */
  readonly fix = signal<GpsFix | null>(null);
  private readonly fixAt = signal(0);

  /** Position, solange sie frisch ist. */
  readonly position = computed(() =>
    this.ticker.now() - this.fixAt() < STALE_MS ? this.fix() : null,
  );
  /** Geschwindigkeit in m/s, solange sie frisch ist. */
  readonly speed = computed(() => this.position()?.speed ?? null);
  /** Kurs in Grad: bleibt im Stand auf dem letzten Wert stehen. */
  readonly heading = signal<number | null>(null);

  constructor() {
    this.ticker.onTick((now) => {
      if (this.state() === 'on' && now - this.lastAnyAt > 10000) this.state.set('busy');
    });
  }

  /** Wird für jede brauchbare Position aufgerufen, in Reihenfolge der Anmeldung. */
  onFix(listener: FixListener): void {
    this.listeners.push(listener);
  }

  start(): void {
    if (this.simulated || this.watchId != null) return;
    if (!('geolocation' in navigator)) {
      this.state.set('err');
      this.toasts.show('Dieser Browser liefert keinen Standort.');
      return;
    }
    this.state.set('busy');
    this.watchId = navigator.geolocation.watchPosition(
      (pos) =>
        this.feed({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          alt: pos.coords.altitude,
          acc: pos.coords.accuracy,
          altAcc: pos.coords.altitudeAccuracy,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
          t: pos.timestamp,
        }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          if (this.watchId != null) navigator.geolocation.clearWatch(this.watchId);
          this.watchId = null;
          this.state.set('err');
          this.toasts.show(
            'Standortzugriff abgelehnt. In den iOS-Einstellungen für diesen Browser erlauben, dann GPS antippen.',
          );
        } else if (Date.now() - this.lastAnyAt > 10000) {
          this.state.set('busy');
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  }

  /** Nimmt eine Rohposition entgegen (vom Gerät oder aus der Simulation). */
  feed(raw: GpsFix): void {
    const now = Date.now();
    this.lastAnyAt = now;
    this.state.set('on');
    this.accuracy.set(raw.acc);
    if (raw.acc == null || raw.acc > MAX_ACCURACY_M) return;

    const prev = this.fix();
    let speed = raw.speed != null && raw.speed >= 0 ? raw.speed : null;
    let heading =
      raw.heading != null && Number.isFinite(raw.heading) && raw.heading >= 0 ? raw.heading : null;
    if (prev) {
      const dt = (raw.t - prev.t) / 1000;
      const d = haversine(prev.lat, prev.lon, raw.lat, raw.lon);
      if (speed == null && dt > 0 && dt < 10) speed = d / dt;
      if (heading == null && d > 3) heading = bearing(prev.lat, prev.lon, raw.lat, raw.lon);
    }
    const fix: GpsFix = { ...raw, speed, heading };
    // Im Stand springt der Kurs: nur in Bewegung übernehmen.
    if (heading != null && (speed ?? 0) > 1) this.heading.set(heading);
    this.fix.set(fix);
    this.fixAt.set(now);
    for (const listener of this.listeners) listener(fix);
  }
}
