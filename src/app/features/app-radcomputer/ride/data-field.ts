import { Component, input } from '@angular/core';

/** Ein Datenfeld: kleine Beschriftung oben, großer Wert unten. */
@Component({
  selector: 'rc-data-field',
  template: `
    <span class="label">
      {{ label() }}
      @if (unit()) {
        <span>{{ unit() }}</span>
      }
    </span>
    <span class="value digits" [class.long]="value().length > 5">{{ value() }}</span>
  `,
  host: {
    '[class.hero]': 'size() === "hero"',
    '[class.wide]': 'size() !== "normal"',
  },
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
    :host(.wide) {
      grid-column: 1 / -1;
    }
    .label {
      font-family: var(--digits);
      font-size: var(--t-m);
      font-weight: 700;
      color: var(--muted);
      display: flex;
      justify-content: space-between;
      gap: 8px;
      white-space: nowrap;
    }
    .label span {
      font-weight: 400;
    }
    .value {
      line-height: 0.9;
      letter-spacing: -0.02em;
      white-space: nowrap;
      font-size: min(15.5vw, 9.5vh);
    }
    .value.long {
      font-size: min(11.5vw, 7.5vh);
    }
    :host(.wide) .value.long {
      font-size: min(15.5vw, 9.5vh);
    }
    :host(.hero) .value {
      font-size: min(31vw, 17vh);
    }
    :host(.hero) .value.long {
      font-size: min(23vw, 14vh);
    }
  `,
})
export class DataField {
  readonly label = input.required<string>();
  readonly unit = input('');
  readonly value = input.required<string>();
  readonly size = input<'normal' | 'wide' | 'hero'>('normal');
}
