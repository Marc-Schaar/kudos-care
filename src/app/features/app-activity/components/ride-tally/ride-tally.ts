import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NavigationService } from '../../../../shared/services/navigation-service/navigation-service';
import { Activity } from '../../../../shared/services/strava-service/strava-service';
import { buildTally, TallyMark } from '../../models/ride-insights';

/**
 * Die Strichliste der letzten Monate: jede Fahrt ein Strich, Höhe nach Distanz, nasse in Blau.
 * Zeigt auf einen Blick, woher der Wetter-Aufschlag am Verschleiß-Lineal kommt.
 *
 * Für Screenreader und die Tastatur ist die Grafik ausgeblendet: dieselben Fahrten stehen als
 * Links in der Liste daneben, und hundert zusätzliche Tab-Stopps hülfen niemandem.
 */
@Component({
  selector: 'app-ride-tally',
  imports: [DatePipe, DecimalPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="tally">
      <div class="plot" aria-hidden="true" (mouseleave)="hover.set(null)">
        <div class="baseline"></div>
        @for (mark of tally().marks; track mark.id) {
          <a
            class="mark"
            tabindex="-1"
            [class.wet]="mark.wet"
            [class.on]="hover()?.id === mark.id"
            [style.left.%]="mark.x"
            [routerLink]="nav.to.activity(mark.id)"
            (mouseenter)="hover.set(mark)"
          >
            <span class="bar" [style.height.%]="mark.height"></span>
          </a>
        }
        @if (hover(); as mark) {
          <div class="tip" [style.left.%]="clamp(mark.x)">
            <span class="tip-name">{{ mark.name }}</span>
            <span class="tip-meta g-num">
              {{ mark.date | date: 'd. MMM' }} · {{ mark.km | number: '1.0-1' }} km
              @if (mark.wet) {
                · nass
              }
            </span>
          </div>
        }
      </div>

      <div class="axis" aria-hidden="true">
        @for (tick of tally().ticks; track tick.label + tick.x) {
          <span class="tick" [style.left.%]="tick.x">{{ tick.label }}</span>
        }
      </div>

      <figcaption class="caption">
        <span class="key"><i class="swatch"></i>trocken</span>
        <span class="key"><i class="swatch wet"></i>nass</span>
        <span class="summary">
          {{ tally().marks.length }} {{ tally().marks.length === 1 ? 'Fahrt' : 'Fahrten' }},
          {{ tally().totalKm | number: '1.0-0' }} km, davon {{ tally().wetCount }} nass
        </span>
      </figcaption>
    </figure>
  `,
  styles: `
    :host {
      display: block;
    }

    .plot {
      position: relative;
      height: 5rem;
    }

    .baseline {
      position: absolute;
      inset: auto 0 0;
      height: 1px;
      background: var(--border);
    }

    /* Die Trefferfläche ist breiter als der Strich: drei Pixel trifft niemand. */
    .mark {
      position: absolute;
      top: 0;
      bottom: 0;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      width: 0.75rem;
      transform: translateX(-50%);
    }

    .bar {
      width: 3px;
      background: var(--border-strong);
      border-radius: 2px 2px 0 0;
      transition: background-color 0.1s var(--ease-out);
    }

    .mark.wet .bar {
      background: var(--rain);
    }

    .mark.on .bar {
      background: var(--text);
    }

    .tip {
      position: absolute;
      bottom: calc(100% - 0.75rem);
      z-index: 2;
      display: flex;
      flex-direction: column;
      max-width: 14rem;
      padding: 0.35rem 0.6rem;
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: var(--r-s);
      box-shadow: var(--e-float);
      transform: translateX(-50%);
      pointer-events: none;
      white-space: nowrap;
    }

    .tip-name {
      overflow: hidden;
      font-size: var(--t-sm);
      font-weight: 500;
      text-overflow: ellipsis;
    }

    .tip-meta {
      font-size: var(--t-xs);
      color: var(--muted);
    }

    .axis {
      position: relative;
      height: 1.25rem;
      margin-top: 0.25rem;
    }

    .tick {
      position: absolute;
      font-size: var(--t-xs);
      color: var(--muted);
      transform: translateX(-50%);
    }

    .caption {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.25rem 1rem;
      margin-top: 0.25rem;
      font-size: var(--t-sm);
      color: var(--muted);
    }

    .key {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }

    .swatch {
      display: inline-block;
      width: 3px;
      height: 0.875rem;
      background: var(--border-strong);
      border-radius: 2px;
    }

    .swatch.wet {
      background: var(--rain);
    }

    .summary {
      margin-left: auto;
    }
  `,
})
export class RideTally {
  readonly nav = inject(NavigationService);

  activities = input.required<Activity[]>();
  months = input(6);

  hover = signal<TallyMark | null>(null);

  tally = computed(() => buildTally(this.activities(), new Date(), this.months()));

  /** Hält den Hinweis innerhalb der Grafik, auch über dem ersten und letzten Strich. */
  clamp(x: number): number {
    return Math.min(Math.max(x, 22), 78);
  }
}
