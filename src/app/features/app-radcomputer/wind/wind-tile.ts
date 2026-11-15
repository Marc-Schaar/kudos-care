import { Component, computed, inject } from '@angular/core';

import { DASH } from '../core/format';
import { Wind, WindState, compassPoint, windWord } from '../core/wind';
import { WindArrow } from './wind-arrow';

const STATE_HINT: Record<WindState, string> = {
  off: 'warte auf GPS',
  consent: 'Wetterdaten nicht freigegeben',
  loading: 'wird geladen …',
  ok: '',
  offline: 'kein Netz',
  error: 'Wetterdienst nicht erreichbar',
};

/**
 * Wind-Kachel einer Datenseite. Groß steht, was der Wind beim Fahren ausmacht: der Anteil
 * gegen oder mit der Fahrtrichtung. Darunter klein Stärke, Herkunft und Böen.
 */
@Component({
  selector: 'rc-wind-tile',
  imports: [WindArrow],
  template: `
    <span class="label">{{ title() }}</span>
    <span class="value digits">
      @if (rotation() != null) {
        <rc-wind-arrow class="arrow" [rotation]="rotation()!" [kind]="kind()" />
      }
      <span class="num">{{ value() }}</span>
      @if (value() !== dash) {
        <span class="unit">km/h</span>
      }
    </span>
    <span class="sub">{{ sub() }}</span>
  `,
  host: { '[attr.data-kind]': 'kind() ?? "none"' },
  styles: `
    :host {
      background: var(--bg);
      min-width: 0;
      min-height: 0;
      padding: 8px var(--gutter) 6px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .label,
    .sub {
      font-family: var(--digits);
      font-weight: 700;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .label {
      font-size: var(--t-m);
    }
    :host([data-kind='head']) .label {
      color: var(--head);
    }
    :host([data-kind='tail']) .label {
      color: var(--tail);
    }
    .sub {
      font-size: var(--t-s);
    }
    .value {
      display: flex;
      align-items: baseline;
      line-height: 0.9;
      letter-spacing: -0.02em;
      white-space: nowrap;
      font-size: min(13vw, 8vh);
    }
    .arrow {
      align-self: center;
      width: 0.8em;
      height: 0.8em;
      margin-right: 0.08em;
    }
    .unit {
      margin-left: 0.14em;
      font-size: max(var(--t-m), 0.27em);
      letter-spacing: 0;
      color: var(--muted);
    }
    /* Wie rc-data-field: ohne Aufzeichnung Umrissziffern. */
    :host-context([data-s='idle']) .num,
    :host-context([data-s='paused']) .num,
    :host-context([data-s='auto']) .num {
      color: var(--bg);
      -webkit-text-stroke: max(3px, 0.07em) var(--fg);
      paint-order: stroke fill;
    }
    :host-context([data-s='auto']) .num {
      -webkit-text-stroke-color: var(--hold);
    }
  `,
})
export class WindTile {
  private readonly wind = inject(Wind);
  protected readonly dash = DASH;

  protected readonly kind = computed(() => this.wind.relative()?.kind ?? null);

  protected readonly title = computed(() => {
    const rel = this.wind.relative();
    if (!rel) return 'Wind';
    if (rel.kind === 'head') return 'Gegenwind';
    if (rel.kind === 'tail') return 'Rückenwind';
    return rel.cross > 0 ? 'Seitenwind rechts' : 'Seitenwind links';
  });

  /** Gegen-/Rückenanteil, bei Seitenwind der Queranteil, ohne Kurs die Windstärke. */
  protected readonly value = computed(() => {
    const wind = this.wind.current();
    if (!wind) return DASH;
    const rel = this.wind.relative();
    if (!rel) return String(Math.round(wind.speed_kmh));
    return String(Math.round(Math.abs(rel.kind === 'cross' ? rel.cross : rel.head)));
  });

  /** Pfeilrichtung in Fahrtrichtung, ohne Kurs mit Norden oben. */
  protected readonly rotation = computed<number | null>(() => {
    const wind = this.wind.current();
    if (!wind) return null;
    const rel = this.wind.relative();
    return ((rel ? rel.fromDeg : wind.direction_deg) + 180) % 360;
  });

  protected readonly sub = computed(() => {
    const wind = this.wind.current();
    if (!wind) return STATE_HINT[this.wind.state()] || STATE_HINT.off;
    const parts = [
      `${Math.round(wind.speed_kmh)} ${windWord(wind.speed_kmh)} aus ${compassPoint(wind.direction_deg)}`,
    ];
    if (wind.gusts_kmh != null && wind.gusts_kmh > wind.speed_kmh + 5)
      parts.push(`Böen ${Math.round(wind.gusts_kmh)}`);
    if (this.wind.state() === 'offline') parts.push('alt');
    return parts.join(' · ');
  });
}
