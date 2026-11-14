import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';

import { AudioFeedback } from '../core/audio-feedback';
import { clamp, speakDuration } from '../core/format';
import { RideRecorder } from '../core/ride-recorder';
import { Sensors } from '../core/sensors';
import { SettingsStore } from '../core/settings-store';
import { Toasts } from '../core/toasts';
import { Compliance, Workout, WorkoutStatus, WorkoutStep } from './workout-models';
import { parseWorkoutFile } from './workout-parsers';

/** Erst nach so langer Abweichung wird gewarnt, und höchstens so oft (ms). */
const ALERT_AFTER_MS = 10000;
const ALERT_EVERY_MS = 30000;

export function describeTarget(step: WorkoutStep, spoken = false): string {
  const unit = spoken ? ' Watt' : ' W';
  if (step.fromW == null || step.toW == null) return 'frei fahren';
  if (step.fromW === step.toW) return `${step.fromW}${unit}`;
  return spoken ? `von ${step.fromW} auf ${step.toW} Watt` : `${step.fromW} → ${step.toW} W`;
}

/**
 * Spielt ein geplantes Training ab. Die Trainingsuhr hängt an der Fahrzeit der
 * Aufzeichnung: Bei Pause und Auto-Pause steht auch sie. Jeder Schritt wird
 * eine eigene Runde, damit die Intervalle später einzeln auswertbar sind.
 */
@Injectable({ providedIn: 'root' })
export class WorkoutPlayer {
  private readonly ride = inject(RideRecorder);
  private readonly sensors = inject(Sensors);
  private readonly settings = inject(SettingsStore);
  private readonly audio = inject(AudioFeedback);
  private readonly toasts = inject(Toasts);
  private outOfRangeMs = 0;
  private lastAlertAt = 0;

  readonly workout = signal<Workout | null>(null);
  readonly status = signal<WorkoutStatus>('none');
  readonly stepIndex = signal(0);
  /** Abgelaufene Zeit im aktuellen Schritt */
  readonly stepMs = signal(0);

  readonly step = computed(() => this.workout()?.steps[this.stepIndex()] ?? null);
  readonly nextStep = computed(() => this.workout()?.steps[this.stepIndex() + 1] ?? null);
  readonly stepRemainingS = computed(() => {
    const step = this.step();
    return step ? Math.max(0, Math.ceil(step.durationS - this.stepMs() / 1000)) : 0;
  });
  /** Zielleistung jetzt; bei Rampen wandert sie mit. */
  readonly targetW = computed(() => {
    const step = this.step();
    if (!step || step.fromW == null || step.toW == null) return null;
    const f = clamp(this.stepMs() / 1000 / step.durationS, 0, 1);
    return Math.round(step.fromW + (step.toW - step.fromW) * f);
  });
  /** Zielbereich: ±5 %, mindestens ±10 W. */
  readonly range = computed(() => {
    const target = this.targetW();
    if (target == null) return null;
    const tolerance = Math.max(10, Math.round(target * 0.05));
    return { low: target - tolerance, high: target + tolerance };
  });
  readonly compliance = computed<Compliance>(() => {
    const range = this.range();
    const power = this.sensors.power3s();
    if (this.status() !== 'running' || !range || power == null) return 'none';
    return power < range.low ? 'low' : power > range.high ? 'high' : 'ok';
  });
  readonly elapsedS = computed(() => {
    const workout = this.workout();
    if (!workout) return 0;
    const before = workout.steps
      .slice(0, this.stepIndex())
      .reduce((sum, s) => sum + s.durationS, 0);
    return before + this.stepMs() / 1000;
  });
  readonly progress = computed(() => {
    const workout = this.workout();
    if (!workout) return 0;
    return this.status() === 'done' ? 1 : clamp(this.elapsedS() / workout.totalS, 0, 1);
  });

  constructor() {
    this.ride.onRideTick((dtMs, counting) => this.onRideTick(dtMs, counting));
    // Wird die Fahrt verworfen, endet auch das laufende Training.
    effect(() => {
      if (this.ride.status() === 'idle' && untracked(this.status) === 'running') this.stop();
    });
  }

  async loadFile(file: File): Promise<boolean> {
    try {
      // FIT ist binär: gar nicht erst als Text lesen.
      const content = /\.fit$/i.test(file.name) ? '' : await file.text();
      this.load(parseWorkoutFile(file.name, content, this.settings.ftp()));
      return true;
    } catch (err) {
      this.toasts.show(
        err instanceof Error ? err.message : 'Die Datei konnte nicht gelesen werden.',
      );
      return false;
    }
  }

  load(workout: Workout): void {
    if (this.status() === 'running') this.stop();
    this.workout.set(workout);
    this.stepIndex.set(0);
    this.stepMs.set(0);
    this.status.set('ready');
  }

  clear(): void {
    if (this.status() === 'running') this.stop();
    this.workout.set(null);
    this.status.set('none');
  }

  /** Startet das Training und, falls nötig, die Aufzeichnung. */
  start(): void {
    const workout = this.workout();
    if (!workout || this.status() === 'running') return;
    const fresh = this.ride.status() === 'idle';
    this.ride.workoutActive.set(true);
    this.ride.start();
    this.stepIndex.set(0);
    this.stepMs.set(0);
    this.outOfRangeMs = 0;
    this.status.set('running');
    if (fresh) this.ride.labelCurrentLap(workout.steps[0].label);
    else this.ride.lap(workout.steps[0].label, false);
    this.announceStep(workout, 0);
  }

  skip(): void {
    const workout = this.workout();
    if (!workout || this.status() !== 'running') return;
    this.goTo(workout, this.stepIndex() + 1, 0);
  }

  /** Bricht ab; die Aufzeichnung läuft weiter. */
  stop(): void {
    const wasRunning = this.status() === 'running';
    this.ride.workoutActive.set(false);
    this.stepIndex.set(0);
    this.stepMs.set(0);
    this.status.set(this.workout() ? 'ready' : 'none');
    if (wasRunning && this.ride.status() !== 'idle') {
      this.ride.lap('Nach dem Training', false);
      this.audio.say('Training beendet');
    }
  }

  private onRideTick(dtMs: number, counting: boolean): void {
    const workout = this.workout();
    if (!workout || this.status() !== 'running' || !counting) return;
    const before = this.stepRemainingS();
    let index = this.stepIndex();
    let ms = this.stepMs() + dtMs;
    while (index < workout.steps.length && ms >= workout.steps[index].durationS * 1000) {
      ms -= workout.steps[index].durationS * 1000;
      index++;
    }
    if (index !== this.stepIndex()) {
      this.goTo(workout, index, ms);
      return;
    }
    this.stepMs.set(ms);
    const remaining = this.stepRemainingS();
    if (remaining !== before && remaining >= 1 && remaining <= 3) this.audio.tone('tick'); // 3, 2, 1
    this.checkPower(dtMs);
  }

  private goTo(workout: Workout, index: number, ms: number): void {
    this.outOfRangeMs = 0;
    if (index >= workout.steps.length) {
      this.ride.workoutActive.set(false);
      this.status.set('done');
      this.ride.lap('Nach dem Training', false);
      this.audio.say('Training abgeschlossen', { tone: 'go', urgent: true });
      return;
    }
    this.stepIndex.set(index);
    this.stepMs.set(ms);
    this.ride.lap(workout.steps[index].label, false);
    this.announceStep(workout, index);
  }

  private announceStep(workout: Workout, index: number): void {
    const step = workout.steps[index];
    this.audio.say(
      `${step.label}. ${speakDuration(step.durationS)}, ${describeTarget(step, true)}`,
      { tone: 'go', urgent: index > 0 },
    );
  }

  private checkPower(dtMs: number): void {
    const compliance = this.compliance();
    if (!this.settings.value().powerAlerts || compliance === 'none' || compliance === 'ok') {
      this.outOfRangeMs = 0;
      return;
    }
    this.outOfRangeMs += dtMs;
    const now = Date.now();
    // Am Schrittanfang erst einmal Zeit lassen, die neue Leistung zu treffen.
    if (
      this.outOfRangeMs >= ALERT_AFTER_MS &&
      this.stepMs() >= ALERT_AFTER_MS &&
      now - this.lastAlertAt >= ALERT_EVERY_MS
    ) {
      this.lastAlertAt = now;
      this.audio.say(compliance === 'low' ? 'Leistung zu niedrig' : 'Leistung zu hoch', {
        tone: 'alert',
      });
    }
  }
}
