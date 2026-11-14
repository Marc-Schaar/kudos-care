import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';

import { AudioFeedback } from './audio-feedback';
import { speakDuration } from './format';
import { haversine } from './geo';
import { Gps } from './gps';
import { GpsFix, Lap, RideDisplayState, RideStats, RideStatus, TrackPoint } from './models';
import { ScreenWake } from './screen-wake';
import { Sensors } from './sensors';
import { SettingsStore } from './settings-store';
import { store } from './storage';
import { Ticker } from './ticker';
import { Toasts } from './toasts';

const RIDE_KEY = 'radcomputer.ride.v2';
/** Unterhalb davon zählt GPS-Zappeln im Stand nicht als Strecke (m/s). */
const MOVING = 0.8;
/** Die Auto-Pause endet erst etwas über der Schwelle, damit sie nicht flattert (m/s). */
const RESUME_MARGIN = 0.3;

interface SavedRide {
  status: RideStatus;
  stats: RideStats;
  laps: Lap[];
  track: TrackPoint[];
}

type RideTickListener = (dtMs: number, counting: boolean) => void;

const emptyStats = (): RideStats => ({
  startedAt: null,
  movingMs: 0,
  distanceM: 0,
  ascentM: 0,
  pwrSum: 0,
  pwrN: 0,
  pwrMax: 0,
});
const newLap = (trackIdx: number, stats: RideStats, label: string | null): Lap => ({
  trackIdx,
  t0: stats.movingMs,
  d0: stats.distanceM,
  pwrSum: 0,
  pwrN: 0,
  label,
});

/** Zeichnet die Fahrt auf: Zeit, Strecke, Leistung, Runden, Auto-Pause. */
@Injectable({ providedIn: 'root' })
export class RideRecorder {
  private readonly doc = inject(DOCUMENT);
  private readonly ticker = inject(Ticker);
  private readonly gps = inject(Gps);
  private readonly sensors = inject(Sensors);
  private readonly settings = inject(SettingsStore);
  private readonly wake = inject(ScreenWake);
  private readonly audio = inject(AudioFeedback);
  private readonly toasts = inject(Toasts);

  private readonly tickListeners: RideTickListener[] = [];
  /** Wächst jede Sekunde und ist deshalb bewusst kein Signal; `trackLength` meldet Änderungen. */
  private track: TrackPoint[] = [];
  private prevFix: GpsFix | null = null;
  private refAlt: number | null = null;
  private ticks = 0;

  readonly status = signal<RideStatus>('idle');
  readonly stats = signal<RideStats>(emptyStats());
  readonly laps = signal<Lap[]>([newLap(0, emptyStats(), null)]);
  readonly autoPaused = signal(false);
  readonly trackLength = signal(0);
  /** Vom Trainingsmodus gesetzt: entscheidet mit, ob die Auto-Pause greifen darf. */
  readonly workoutActive = signal(false);

  readonly displayState = computed<RideDisplayState>(() =>
    this.status() === 'running' && this.autoPaused() ? 'auto' : this.status(),
  );
  readonly currentLap = computed(() => this.laps()[this.laps().length - 1]);
  readonly hasData = computed(() => this.trackLength() > 0);

  constructor() {
    this.restore();
    this.gps.onFix((fix) => this.onFix(fix));
    this.ticker.onTick((now, dt) => this.advance(now, dt));
    this.doc.defaultView?.addEventListener('pagehide', () => this.persist());
    this.doc.addEventListener('visibilitychange', () => {
      if (this.doc.visibilityState === 'hidden') this.persist();
    });
  }

  /** Läuft nach jedem Sekundentakt der Aufzeichnung. `counting` ist falsch, solange pausiert ist. */
  onRideTick(listener: RideTickListener): void {
    this.tickListeners.push(listener);
  }

  /** Start, Pause, Weiter: je nach Zustand. */
  toggle(): void {
    this.audio.unlock();
    const status = this.status();
    if (status === 'idle') {
      this.stats.update((s) => ({ ...s, startedAt: Date.now() }));
      this.status.set('running');
      this.audio.say('Aufnahme gestartet', { tone: 'go' });
    } else if (status === 'running') {
      this.status.set('paused');
      this.autoPaused.set(false);
      this.persist();
      this.audio.say('Pausiert');
    } else {
      this.status.set('running');
      this.audio.say('Weiter', { tone: 'go' });
    }
    const running = this.status() === 'running';
    this.wake.keepAwake(running);
    if (running) this.gps.start();
  }

  start(): void {
    if (this.status() !== 'running') this.toggle();
  }

  /** Neue Runde. `label` nutzt der Trainingsmodus für die Intervallnamen. */
  lap(label: string | null = null, announce = true): void {
    if (this.status() !== 'running') return;
    const prev = this.currentLap();
    const stats = this.stats();
    this.laps.update((laps) => [...laps, newLap(this.track.length, stats, label)]);
    if (announce && this.settings.value().lapAnnouncements) {
      const avg = prev.pwrN ? `, ${Math.round(prev.pwrSum / prev.pwrN)} Watt` : '';
      this.audio.say(
        `Runde ${this.laps().length}. Letzte Runde ${speakDuration((stats.movingMs - prev.t0) / 1000)}${avg}`,
      );
    }
  }

  labelCurrentLap(label: string): void {
    this.laps.update((laps) =>
      laps.map((lap, i) => (i === laps.length - 1 ? { ...lap, label } : lap)),
    );
  }

  reset(): void {
    this.status.set('idle');
    this.stats.set(emptyStats());
    this.laps.set([newLap(0, emptyStats(), null)]);
    this.autoPaused.set(false);
    this.track = [];
    this.trackLength.set(0);
    this.refAlt = null;
    this.wake.keepAwake(false);
    store.del(RIDE_KEY);
  }

  /** Momentaufnahme für Export und Upload. */
  snapshot(): SavedRide {
    return { status: this.status(), stats: this.stats(), laps: this.laps(), track: this.track };
  }

  persist(): void {
    if (this.status() !== 'idle') store.set(RIDE_KEY, this.snapshot());
  }

  private restore(): void {
    const saved = store.get<SavedRide>(RIDE_KEY);
    if (
      !saved ||
      saved.status === 'idle' ||
      !Array.isArray(saved.track) ||
      !Array.isArray(saved.laps) ||
      !saved.laps.length
    )
      return;
    this.stats.set({ ...emptyStats(), ...saved.stats });
    this.laps.set(saved.laps.map((lap) => ({ ...lap, label: lap.label ?? null })));
    this.track = saved.track;
    this.trackLength.set(saved.track.length);
    this.status.set('paused');
    this.toasts.show('Letzte Fahrt wiederhergestellt. Sie ist pausiert.');
  }

  private counting(): boolean {
    return this.status() === 'running' && !this.autoPaused();
  }

  private onFix(fix: GpsFix): void {
    const prev = this.prevFix;
    this.prevFix = fix;
    const counting = this.counting();
    let dDist = 0;
    let dAscent = 0;

    if (prev && counting) {
      const d = haversine(prev.lat, prev.lon, fix.lat, fix.lon);
      const dt = (fix.t - prev.t) / 1000;
      // Sprünge (über 126 km/h) und Zappeln im Stand zählen nicht.
      if (dt > 0 && d / dt < 35 && (fix.speed ?? d / dt) >= MOVING) dDist = d;
    }
    if (fix.alt != null && (fix.altAcc == null || fix.altAcc <= 15)) {
      if (this.refAlt == null) this.refAlt = fix.alt;
      const dAlt = fix.alt - this.refAlt; // 2 m Hysterese gegen GPS-Rauschen
      if (dAlt >= 2) {
        if (counting) dAscent = dAlt;
        this.refAlt = fix.alt;
      } else if (dAlt <= -2) {
        this.refAlt = fix.alt;
      }
    }
    if (dDist || dAscent) {
      this.stats.update((s) => ({
        ...s,
        distanceM: s.distanceM + dDist,
        ascentM: s.ascentM + dAscent,
      }));
    }
  }

  private advance(now: number, dtMs: number): void {
    if (this.status() !== 'running') {
      for (const listener of this.tickListeners) listener(dtMs, false);
      return;
    }
    this.updateAutoPause();
    const counting = !this.autoPaused();
    if (counting) {
      const power = this.sensors.power();
      this.stats.update((s) => ({
        ...s,
        movingMs: s.movingMs + dtMs,
        pwrSum: power != null ? s.pwrSum + power : s.pwrSum,
        pwrN: power != null ? s.pwrN + 1 : s.pwrN,
        pwrMax: power != null && power > s.pwrMax ? power : s.pwrMax,
      }));
      if (power != null) {
        this.laps.update((laps) =>
          laps.map((lap, i) =>
            i === laps.length - 1
              ? { ...lap, pwrSum: lap.pwrSum + power, pwrN: lap.pwrN + 1 }
              : lap,
          ),
        );
      }
      const pos = this.gps.position();
      const cadence = this.sensors.cadence();
      this.track.push([
        now,
        pos?.lat ?? null,
        pos?.lon ?? null,
        pos?.alt ?? null,
        Math.round(this.stats().distanceM * 10) / 10,
        this.sensors.hr(),
        cadence == null ? null : Math.round(cadence),
        power,
      ]);
      this.trackLength.set(this.track.length);
    }
    this.ticks += 1;
    if (this.ticks % 20 === 0) this.persist();
    for (const listener of this.tickListeners) listener(dtMs, counting);
  }

  private updateAutoPause(): void {
    const s = this.settings.value();
    const enabled = s.autoPause && (!this.workoutActive() || s.autoPauseInWorkout);
    const speed = this.gps.speed();
    const threshold = this.settings.autoPauseSpeed();
    const was = this.autoPaused();
    // Ohne GPS-Geschwindigkeit (z. B. auf der Rolle) gibt es keine Auto-Pause.
    const now = enabled && speed != null && speed < (was ? threshold + RESUME_MARGIN : threshold);
    if (now === was) return;
    this.autoPaused.set(now);
    if (now) this.audio.say('Auto-Pause');
    else this.audio.say('Weiter', { tone: 'go' });
  }
}
