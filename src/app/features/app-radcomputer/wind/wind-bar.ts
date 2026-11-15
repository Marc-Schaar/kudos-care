import { Component, computed, inject } from '@angular/core';

import { clamp } from '../core/format';
import { Wind, WindKind } from '../core/wind';

/** Ab dieser Windstärke ist der Balken voll. */
const FULL_KMH = 40;

/**
 * Windbalken am rechten Rand der Fahrtseiten, sichtbar, sobald Winddaten vorliegen. Die
 * Länge ist die Windstärke, die Farbe die Wirkung: rot Gegenwind, grün Rückenwind, grau
 * Seitenwind oder noch kein Kurs. Zusätzlich zur Farbe zeigt eine Spitze am Balkenende die
 * Richtung (nach unten = bremst, nach oben = schiebt), lesbar auch ohne Farbsehen.
 */
@Component({
  selector: 'rc-wind-bar',
  template: `
    <div class="track">
      <span class="tick" style="bottom: 25%"></span>
      <span class="tick" style="bottom: 50%"></span>
      <span class="tick" style="bottom: 75%"></span>
      <div class="fill" [style.height.%]="fillPct()">
        @if (kind() === 'head' || kind() === 'tail') {
          <span class="tip"></span>
        }
      </div>
    </div>
  `,
  host: {
    role: 'img',
    '[attr.aria-label]': 'label()',
    '[attr.data-kind]': 'kind() ?? "none"',
  },
  styles: `
    :host {
      display: block;
      width: 16px;
      height: 100%;
      padding: 4px 3px;
      border-left: 1px solid var(--line);
      background: var(--bg);
    }
    .track {
      position: relative;
      height: 100%;
      background: var(--panel);
      border-radius: 2px;
    }
    .tick {
      position: absolute;
      left: 0;
      right: 0;
      height: 1px;
      background: var(--line);
    }
    .fill {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      border-radius: 2px;
      background: var(--edge);
      transition: height 0.6s ease-out;
    }
    :host([data-kind='head']) .fill {
      background: var(--head);
    }
    :host([data-kind='tail']) .fill {
      background: var(--tail);
    }
    /* Spitze am oberen Ende: Gegenwind zeigt nach unten, Rückenwind nach oben. */
    .tip {
      position: absolute;
      left: 50%;
      top: 4px;
      width: 0;
      height: 0;
      transform: translateX(-50%);
      border-left: 4px solid transparent;
      border-right: 4px solid transparent;
    }
    :host([data-kind='head']) .tip {
      border-top: 6px solid var(--bg);
    }
    :host([data-kind='tail']) .tip {
      border-bottom: 6px solid var(--bg);
    }
    @media (prefers-reduced-motion: reduce) {
      .fill {
        transition: none;
      }
    }
  `,
})
export class WindBar {
  private readonly wind = inject(Wind);

  protected readonly kind = computed<WindKind | null>(() => this.wind.relative()?.kind ?? null);
  protected readonly fillPct = computed(() => {
    const speed = this.wind.current()?.speed_kmh ?? 0;
    // Ein Rest bleibt immer sichtbar, damit „windstill“ nicht wie „keine Daten“ aussieht.
    return clamp((speed / FULL_KMH) * 100, 4, 100);
  });
  protected readonly label = computed(() => {
    const speed = Math.round(this.wind.current()?.speed_kmh ?? 0);
    const kind = this.kind();
    const word =
      kind === 'head'
        ? 'Gegenwind'
        : kind === 'tail'
          ? 'Rückenwind'
          : kind === 'cross'
            ? 'Seitenwind'
            : 'Wind';
    return `${word}, Windstärke ${speed} km/h`;
  });
}
