import { Injectable, inject, signal } from '@angular/core';

import { TrackPoint } from './models';
import { RideRecorder } from './ride-recorder';
import { Sensors } from './sensors';
import { Ticker } from './ticker';

/** Rollendes Mittel für Normalized Power: 30 Sekunden, wie bei Coggan. */
const NP_WINDOW = 30;
/** Höchstgeschwindigkeit über so viele Punkte gemittelt: ein GPS-Sprung zählt nicht. */
const SPEED_WINDOW = 5;
/** Steigung über mindestens so viel Strecke: GPS-Höhe rauscht um einige Meter. */
const GRADE_BASE_M = 150;
/** Hysterese für Abstieg, wie beim Anstieg im Recorder. */
const ALT_STEP_M = 2;

/** Aufsummiertes aus dem Track; rechnet bei jedem Punkt nur den neuen hinzu. */
export interface RideTotals {
  /** Arbeit in Joule (Leistung × Sekunden) */
  workJ: number;
  /** Normalized Power, sobald 30 Sekunden Leistung vorliegen */
  np: number | null;
  avgHr: number | null;
  maxHr: number | null;
  /** Ohne Rollphasen (Kadenz 0) */
  avgCadence: number | null;
  /** m/s */
  maxSpeed: number | null;
  descentM: number;
}

/** Was nur aus den letzten Punkten folgt. */
export interface RideLive {
  /** Prozent, positiv bergauf */
  grade: number | null;
  /** Höhenmeter je Stunde über die letzte Minute */
  vam: number | null;
}

const NO_TOTALS: RideTotals = {
  workJ: 0,
  np: null,
  avgHr: null,
  maxHr: null,
  avgCadence: null,
  maxSpeed: null,
  descentM: 0,
};

/**
 * Laufende Summen über einen wachsenden Track. Als eigene Klasse ohne Angular, damit sie
 * sich ohne Recorder prüfen lässt; schrumpft der Track (neue Fahrt), beginnt sie von vorn.
 */
export class TrackAccumulator {
  private seen = 0;
  private workJ = 0;
  private npWindow: number[] = [];
  private npSum = 0;
  private np4 = 0;
  private np4N = 0;
  private hrSum = 0;
  private hrN = 0;
  private hrMax: number | null = null;
  private cadSum = 0;
  private cadN = 0;
  private maxSpeed: number | null = null;
  private descent = 0;
  private refAlt: number | null = null;

  update(track: readonly TrackPoint[]): RideTotals {
    if (track.length < this.seen) this.reset();
    for (let i = this.seen; i < track.length; i++) this.add(track, i);
    this.seen = track.length;
    return this.totals();
  }

  private reset(): void {
    Object.assign(this, new TrackAccumulator());
  }

  private add(track: readonly TrackPoint[], i: number): void {
    const [t, , , alt, dist, hr, cad, pwr] = track[i];
    if (pwr != null) {
      this.workJ += pwr;
      this.npWindow.push(pwr);
      this.npSum += pwr;
      if (this.npWindow.length > NP_WINDOW) this.npSum -= this.npWindow.shift()!;
      if (this.npWindow.length === NP_WINDOW) {
        this.np4 += (this.npSum / NP_WINDOW) ** 4;
        this.np4N += 1;
      }
    }
    if (hr != null && hr > 0) {
      this.hrSum += hr;
      this.hrN += 1;
      this.hrMax = Math.max(this.hrMax ?? 0, hr);
    }
    if (cad != null && cad > 0) {
      this.cadSum += cad;
      this.cadN += 1;
    }
    if (i >= SPEED_WINDOW) {
      const [t0, , , , d0] = track[i - SPEED_WINDOW];
      const dt = (t - t0) / 1000;
      // Nur ohne Lücke dazwischen: über eine Pause hinweg wäre das kein Tempo.
      if (dt > 0 && dt <= SPEED_WINDOW * 1.6) {
        const v = (dist - d0) / dt;
        if (v < 35) this.maxSpeed = Math.max(this.maxSpeed ?? 0, v);
      }
    }
    if (alt != null) {
      if (this.refAlt == null) this.refAlt = alt;
      const d = alt - this.refAlt;
      if (d <= -ALT_STEP_M) {
        this.descent -= d;
        this.refAlt = alt;
      } else if (d >= ALT_STEP_M) {
        this.refAlt = alt;
      }
    }
  }

  private totals(): RideTotals {
    return {
      workJ: this.workJ,
      np: this.np4N ? (this.np4 / this.np4N) ** 0.25 : null,
      avgHr: this.hrN ? this.hrSum / this.hrN : null,
      maxHr: this.hrMax,
      avgCadence: this.cadN ? this.cadSum / this.cadN : null,
      maxSpeed: this.maxSpeed,
      descentM: this.descent,
    };
  }
}

/** Steigung und Steigrate aus den letzten Trackpunkten. */
export function liveClimb(track: readonly TrackPoint[]): RideLive {
  const last = track[track.length - 1];
  if (!last || last[3] == null) return { grade: null, vam: null };
  const [t1, , , alt1, d1] = last;
  let grade: number | null = null;
  let vam: number | null = null;
  // Höchstens drei Minuten zurück: länger her zählt nicht mehr als „gerade“.
  for (let i = track.length - 2; i >= 0 && i >= track.length - 180; i--) {
    const [t0, , , alt0, d0] = track[i];
    if (alt0 == null) continue;
    if (vam == null && t1 - t0 >= 60_000) {
      vam = Math.max(0, ((alt1! - alt0) / (t1 - t0)) * 3_600_000);
    }
    if (grade == null && d1 - d0 >= GRADE_BASE_M) {
      grade = ((alt1! - alt0) / (d1 - d0)) * 100;
    }
    if (grade != null && vam != null) break;
  }
  return { grade, vam };
}

/**
 * Kennzahlen für die frei belegbaren Datenfelder, die der Recorder selbst nicht führt.
 * Gerechnet wird aus dem Track, damit sie nach dem Wiederherstellen einer Fahrt stimmen;
 * nur die gleitenden Leistungsmittel kommen direkt vom Sensor, damit sie auch vor dem
 * Start laufen.
 */
@Injectable({ providedIn: 'root' })
export class RideMetrics {
  private readonly ride = inject(RideRecorder);
  private readonly sensors = inject(Sensors);
  private readonly acc = new TrackAccumulator();
  private readonly powerSamples: (number | null)[] = [];

  readonly totals = signal<RideTotals>(NO_TOTALS);
  readonly live = signal<RideLive>({ grade: null, vam: null });
  readonly power10s = signal<number | null>(null);
  readonly power30s = signal<number | null>(null);

  constructor() {
    inject(Ticker).onTick(() => this.samplePower());
    this.ride.onRideTick(() => this.refresh());
    this.refresh();
  }

  private refresh(): void {
    const track = this.ride.snapshot().track;
    this.totals.set(this.acc.update(track));
    this.live.set(liveClimb(track));
  }

  private samplePower(): void {
    this.powerSamples.push(this.sensors.power());
    if (this.powerSamples.length > 30) this.powerSamples.shift();
    this.power10s.set(mean(this.powerSamples.slice(-10)));
    this.power30s.set(mean(this.powerSamples));
  }
}

function mean(values: (number | null)[]): number | null {
  const known = values.filter((v): v is number => v != null);
  return known.length ? known.reduce((a, b) => a + b, 0) / known.length : null;
}
