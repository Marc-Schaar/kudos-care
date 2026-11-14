import { Component, computed, input, output } from '@angular/core';

/**
 * Kompassnadel als Schalter für die Kartenausrichtung. Die gefüllte Spitze zeigt
 * immer nach Norden: In Fahrtrichtung dreht sie sich mit, bei Nord oben steht sie.
 */
@Component({
  selector: 'rc-compass',
  template: `
    <button
      type="button"
      [attr.aria-label]="label()"
      [attr.aria-pressed]="headingUp()"
      (click)="toggle.emit()"
    >
      <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <circle class="ring" cx="24" cy="24" r="21" [class.locked]="!headingUp()" />
        <g [attr.transform]="transform()">
          <path class="north" d="M24 6 L31 24 H17 Z" />
          <path class="south" d="M24 42 L31 24 H17 Z" />
          <circle class="hub" cx="24" cy="24" r="2.5" />
        </g>
      </svg>
    </button>
  `,
  styles: `
    :host {
      display: block;
    }
    button {
      width: 56px;
      height: 56px;
      border: 2px solid var(--fg);
      border-radius: 50%;
      background: var(--bg);
      display: grid;
      place-items: center;
    }
    svg {
      width: 44px;
      height: 44px;
      display: block;
    }
    .ring {
      fill: none;
      stroke: var(--line);
      stroke-width: 2;
    }
    /* Nord oben: gestrichelter Ring zeigt, dass die Karte nicht mitdreht. */
    .ring.locked {
      stroke: var(--edge);
      stroke-dasharray: 3 4;
    }
    .north {
      fill: var(--fg);
    }
    .south {
      fill: none;
      stroke: var(--fg);
      stroke-width: 2;
      stroke-linejoin: round;
    }
    .hub {
      fill: var(--bg);
      stroke: var(--fg);
      stroke-width: 1.5;
    }
  `,
})
export class Compass {
  /** Kurs in Grad, 0 = Norden */
  readonly heading = input<number | null>(null);
  readonly headingUp = input(true);
  readonly toggle = output<void>();

  protected readonly transform = computed(() => {
    const heading = this.heading();
    const deg = this.headingUp() && heading != null ? -heading : 0;
    return `rotate(${deg} 24 24)`;
  });

  /** Beginnt mit dem Zustand, damit Sprachsteuerung und Screenreader ihn zuerst hören. */
  protected readonly label = computed(() =>
    this.headingUp()
      ? 'Kompass: Karte in Fahrtrichtung. Tippen für Norden oben.'
      : 'Kompass: Norden oben. Tippen für Fahrtrichtung oben.',
  );
}
