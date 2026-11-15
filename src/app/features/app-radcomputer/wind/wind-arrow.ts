import { Component, computed, input } from '@angular/core';

import { WindKind } from '../core/wind';

/**
 * Pfeil in Strömungsrichtung: Er zeigt, wohin der Wind weht. Gegenwind zeigt also auf den
 * Fahrer zu (nach unten), Rückenwind schiebt nach vorn (nach oben).
 */
@Component({
  selector: 'rc-wind-arrow',
  template: `
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <g [attr.transform]="transform()">
        <path d="M16 3 L25 15 H19 V29 H13 V15 H7 Z" />
      </g>
    </svg>
  `,
  host: { '[attr.data-kind]': 'kind() ?? "none"' },
  styles: `
    :host {
      display: inline-block;
      width: 1em;
      height: 1em;
      flex: none;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
    path {
      fill: var(--fg);
      stroke: var(--bg);
      stroke-width: 1;
      stroke-linejoin: round;
    }
    :host([data-kind='head']) path {
      fill: var(--head);
    }
    :host([data-kind='tail']) path {
      fill: var(--tail);
    }
  `,
})
export class WindArrow {
  /** Wohin der Pfeil zeigt, in Grad im Uhrzeigersinn, 0 = oben */
  readonly rotation = input(0);
  readonly kind = input<WindKind | null>(null);

  protected readonly transform = computed(() => `rotate(${this.rotation()} 16 16)`);
}
