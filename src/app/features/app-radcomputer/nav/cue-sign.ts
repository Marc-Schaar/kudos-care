import { Component, computed, input } from '@angular/core';

import { CueArrow } from './cue-arrow';
import { CueKind } from './nav-models';

type Point = 'left' | 'right' | 'none';

const POINT: Record<CueKind, Point> = {
  left: 'left',
  'slight-left': 'left',
  'sharp-left': 'left',
  right: 'right',
  'slight-right': 'right',
  'sharp-right': 'right',
  uturn: 'none',
  straight: 'none',
  roundabout: 'none',
  arrive: 'none',
};

/**
 * Abbiegehinweis als Radwegweiser: ein Schild, dessen Spitze in die Abbiegerichtung zeigt
 * (geradeaus, Kreisel und Ziel bleiben rechteckig). Wie die Pfeilwegweiser an der Straße
 * hat es eine schmale Innenlinie. Verlassene Route: dasselbe Schild in Rot.
 *
 * Die Form ist Zusatz zum Pfeil, nicht Ersatz: Pfeil und Text tragen die Information auch
 * ohne sie. Das Schild nimmt die Markierungsfarbe (Weiß bei Nacht, Schwarz am Tag), damit
 * es auf beiden Gründen den stärksten Kontrast der Seite hat.
 */
@Component({
  selector: 'rc-cue-sign',
  imports: [CueArrow],
  template: `
    <span class="plate" aria-hidden="true"></span>
    <rc-cue-arrow [kind]="kind()" />
    <span class="dist digits">{{ distance() }}</span>
    <span class="text">{{ text() }}</span>
  `,
  host: {
    '[attr.data-point]': 'point()',
    '[class.off]': 'off()',
    '[class.large]': 'size() === "large"',
  },
  styles: `
    :host {
      --tip: 20px;
      position: relative;
      min-height: 56px;
      padding: 6px 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--bg);
      isolation: isolate;
    }
    :host(.large) {
      --tip: 26px;
      min-height: 76px;
      padding: 8px 16px;
      gap: 12px;
    }
    :host([data-point='right']) {
      padding-right: calc(var(--tip) + 8px);
    }
    :host([data-point='left']) {
      padding-left: calc(var(--tip) + 10px);
    }

    /* Drei Lagen derselben Form: Fläche, Innenlinie (Grundfarbe), wieder Fläche. */
    .plate,
    .plate::before,
    .plate::after {
      position: absolute;
      background: var(--fg);
      clip-path: var(--shape);
    }
    .plate {
      inset: 0;
      z-index: -1;
      border-radius: 3px;
    }
    .plate::before {
      content: '';
      inset: 4px;
      background: var(--bg);
    }
    .plate::after {
      content: '';
      inset: 6px;
    }
    :host {
      --shape: inset(0 round 3px);
    }
    :host([data-point='right']) {
      --shape: polygon(
        0 0,
        calc(100% - var(--tip)) 0,
        100% 50%,
        calc(100% - var(--tip)) 100%,
        0 100%
      );
    }
    :host([data-point='left']) {
      --shape: polygon(var(--tip) 0, 100% 0, 100% 100%, var(--tip) 100%, 0 50%);
    }
    :host(.off) .plate,
    :host(.off) .plate::after {
      background: var(--warn);
    }

    rc-cue-arrow {
      width: 36px;
      height: 36px;
    }
    :host(.large) rc-cue-arrow {
      width: 48px;
      height: 48px;
    }
    .dist {
      font-size: 30px;
      line-height: 1;
      white-space: nowrap;
    }
    :host(.large) .dist {
      font-size: 42px;
    }
    .text {
      min-width: 0;
      font-family: var(--digits);
      font-size: var(--t-l);
      font-weight: 700;
      line-height: 1.15;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    :host(.large) .text {
      font-size: 19px;
    }
  `,
})
export class CueSign {
  readonly kind = input.required<CueKind>();
  readonly distance = input('');
  readonly text = input.required<string>();
  readonly off = input(false);
  readonly size = input<'normal' | 'large'>('normal');

  protected readonly point = computed<Point>(() => (this.off() ? 'none' : POINT[this.kind()]));
}
