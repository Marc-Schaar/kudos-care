import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { fmtTime, num } from '../core/format';
import { RideRecorder } from '../core/ride-recorder';
import { Sensors } from '../core/sensors';
import { SettingsStore } from '../core/settings-store';
import { WorkoutChart } from './workout-chart';
import { Compliance } from './workout-models';
import { WorkoutPlayer, describeTarget } from './workout-player';
import { RC } from '../core/paths';

const VERDICT: Record<Compliance, string> = {
  none: '',
  low: 'zu niedrig',
  ok: 'im Ziel',
  high: 'zu hoch',
};

/** Trainingsseite der Fahrt. Laden und Auswählen geschieht im Menü unter „Training“. */
@Component({
  selector: 'rc-workout-live',
  imports: [WorkoutChart, RouterLink],
  templateUrl: './workout-live.html',
  styleUrl: './workout-live.css',
})
export class WorkoutLive {
  protected readonly rc = RC;
  protected readonly player = inject(WorkoutPlayer);
  protected readonly settings = inject(SettingsStore);
  private readonly ride = inject(RideRecorder);
  private readonly sensors = inject(Sensors);

  protected readonly fmtTime = fmtTime;
  protected readonly describeTarget = describeTarget;

  protected readonly remaining = computed(() => fmtTime(this.player.stepRemainingS() * 1000));
  protected readonly targetText = computed(() => {
    const range = this.player.range();
    return range ? `${range.low}–${range.high}` : 'frei';
  });
  protected readonly targetNote = computed(() => {
    const target = this.player.targetW();
    return target == null ? 'ohne Vorgabe' : `Mitte ${target} W`;
  });
  protected readonly power = computed(() => num(this.sensors.power3s()));
  protected readonly verdict = computed(() => {
    const compliance = this.player.compliance();
    const range = this.player.range();
    const power = this.sensors.power3s();
    if (compliance === 'low' && range && power != null)
      return `${VERDICT.low}, ${Math.round(range.low - power)} W fehlen`;
    if (compliance === 'high' && range && power != null)
      return `${VERDICT.high}, ${Math.round(power - range.high)} W drüber`;
    return VERDICT[compliance];
  });
  protected readonly stepCount = computed(
    () => `${this.player.stepIndex() + 1}/${this.player.workout()?.steps.length ?? 0}`,
  );
  protected readonly clockStopped = computed(
    () => this.player.status() === 'running' && this.ride.displayState() !== 'running',
  );
}
