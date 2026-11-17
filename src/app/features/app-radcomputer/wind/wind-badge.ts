import { Component, computed, inject, input } from '@angular/core';

import { Wind } from '../core/wind';
import { WindArrow } from './wind-arrow';

/**
 * Wind auf der Karte: Der Pfeil zeigt in der Ausrichtung der Karte, wohin der Wind weht,
 * darunter die Windstärke. Bei Fahrtrichtung oben entspricht das der Sicht des Fahrers;
 * eine von Hand gedrehte Karte dreht den Pfeil mit.
 */
@Component({
  selector: 'rc-wind-badge',
  imports: [WindArrow],
  template: `
    @if (wind.current()) {
      <div class="badge" role="img" [attr.aria-label]="label()">
        <rc-wind-arrow class="arrow" [rotation]="rotation()" [kind]="kind()" />
        <span class="digits">{{ speed() }}</span>
        <span class="unit">km/h</span>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .badge {
      width: 56px;
      padding: 4px 0 5px;
      display: grid;
      justify-items: center;
      border: 2px solid var(--fg);
      border-radius: 4px;
      background: var(--bg);
    }
    .arrow {
      width: 28px;
      height: 28px;
    }
    .digits {
      font-size: var(--t-xl);
      font-weight: 700;
      line-height: 1;
    }
    .unit {
      font-family: var(--digits);
      font-size: 11px;
      font-weight: 700;
      color: var(--muted);
    }
  `,
})
export class WindBadge {
  protected readonly wind = inject(Wind);
  /** Drehung der Karte: Kurs, der oben liegt, in Grad (0 = Norden oben) */
  readonly bearing = input(0);

  protected readonly kind = computed(() => this.wind.relative()?.kind ?? null);
  protected readonly speed = computed(() => Math.round(this.wind.current()?.speed_kmh ?? 0));

  protected readonly rotation = computed(() => {
    const from = this.wind.current()?.direction_deg ?? 0;
    return (((from + 180 - this.bearing()) % 360) + 360) % 360;
  });

  protected readonly label = computed(() => {
    const kind = this.kind();
    const word = kind === 'head' ? 'Gegenwind' : kind === 'tail' ? 'Rückenwind' : 'Wind';
    return `${word}, Windstärke ${this.speed()} km/h`;
  });
}
