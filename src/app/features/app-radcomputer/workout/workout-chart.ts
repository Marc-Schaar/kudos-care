import { Component, computed, input } from '@angular/core';

import { fmtTime } from '../core/format';
import { Workout } from './workout-models';

interface Bar {
  points: string;
  state: 'done' | 'current' | 'ahead';
  free: boolean;
}

/** Profil des Trainings: Breite = Dauer, Höhe = Zielleistung. */
@Component({
  selector: 'rc-workout-chart',
  template: `
    <svg viewBox="0 0 1000 100" preserveAspectRatio="none" role="img" [attr.aria-label]="label()">
      @for (bar of bars(); track $index) {
        <polygon [attr.points]="bar.points" [attr.data-state]="bar.state" [class.free]="bar.free" />
      }
      @if (showCursor()) {
        <line class="cursor" [attr.x1]="cursorX()" [attr.x2]="cursorX()" y1="0" y2="100" />
      }
    </svg>
  `,
  styles: `
    :host {
      display: block;
      height: 64px;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
    polygon {
      fill: var(--muted);
    }
    polygon[data-state='done'] {
      fill: var(--edge);
      opacity: 0.55;
    }
    polygon[data-state='current'] {
      fill: var(--fg);
    }
    polygon.free {
      fill: none;
      stroke: var(--muted);
      stroke-width: 2;
      stroke-dasharray: 5 4;
      vector-effect: non-scaling-stroke;
    }
    /* Hier bist du: dieselbe Farbe wie die laufende Aufnahme */
    .cursor {
      stroke: var(--go);
      stroke-width: 3;
      vector-effect: non-scaling-stroke;
    }
  `,
})
export class WorkoutChart {
  readonly workout = input.required<Workout>();
  readonly stepIndex = input(0);
  /** Fortschritt 0..1; ohne Wert gibt es keine Markierung. */
  readonly progress = input<number | null>(null);

  protected readonly showCursor = computed(() => this.progress() != null);
  protected readonly cursorX = computed(() => Math.round((this.progress() ?? 0) * 1000));
  protected readonly label = computed(() => {
    const w = this.workout();
    return `Trainingsprofil: ${w.steps.length} Schritte, ${fmtTime(w.totalS * 1000)} gesamt`;
  });

  protected readonly bars = computed<Bar[]>(() => {
    const workout = this.workout();
    const current = this.progress() == null ? -1 : this.stepIndex();
    const maxW =
      Math.max(100, ...workout.steps.map((s) => Math.max(s.fromW ?? 0, s.toW ?? 0))) * 1.08;
    const y = (w: number | null): number => 100 - (w == null ? 22 : Math.max(8, (w / maxW) * 100));
    let t = 0;
    return workout.steps.map((step, i) => {
      // 2 Einheiten Lücke zwischen den Schritten, damit Wiederholungen zählbar bleiben.
      const x0 = (t / workout.totalS) * 1000;
      t += step.durationS;
      const x1 = Math.max(x0 + 1, (t / workout.totalS) * 1000 - 2);
      return {
        points: `${x0.toFixed(1)},100 ${x0.toFixed(1)},${y(step.fromW).toFixed(1)} ${x1.toFixed(1)},${y(step.toW).toFixed(1)} ${x1.toFixed(1)},100`,
        state: i < current ? 'done' : i === current ? 'current' : 'ahead',
        free: step.fromW == null,
      };
    });
  });
}
