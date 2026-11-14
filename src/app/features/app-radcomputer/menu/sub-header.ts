import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { RC } from '../core/paths';

/** Kopf der Unterseiten im Menü: Zurück und Titel. */
@Component({
  selector: 'rc-sub-header',
  imports: [RouterLink],
  template: `
    <a class="back" [routerLink]="back()">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
      {{ backLabel() }}
    </a>
    <h2>{{ title() }}</h2>
  `,
  styles: `
    :host {
      display: block;
      margin-bottom: 14px;
    }
    .back {
      min-height: 44px;
      margin-left: -6px;
      padding-right: 10px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 16px;
      font-weight: 600;
      color: var(--muted);
      text-decoration: none;
    }
    .back svg {
      width: 22px;
      height: 22px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    h2 {
      font-size: 26px;
      line-height: 1.15;
    }
  `,
})
export class SubHeader {
  readonly title = input.required<string>();
  readonly back = input<string>(RC.menu);
  readonly backLabel = input('Menü');
}
