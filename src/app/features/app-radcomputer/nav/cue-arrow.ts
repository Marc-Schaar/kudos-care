import { Component, computed, input } from '@angular/core';

import { CueKind } from './nav-models';

const ROTATION: Record<CueKind, number> = {
  left: -90,
  right: 90,
  'slight-left': -45,
  'slight-right': 45,
  'sharp-left': -135,
  'sharp-right': 135,
  uturn: 180,
  straight: 0,
  roundabout: 0,
  arrive: 0,
};

/** Richtungspfeil zum Abbiegehinweis. Rein dekorativ: der Hinweistext steht daneben. */
@Component({
  selector: 'rc-cue-arrow',
  template: `
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      @switch (kind()) {
        @case ('arrive') {
          <circle cx="24" cy="24" r="15" fill="none" stroke="currentColor" stroke-width="5" />
          <circle cx="24" cy="24" r="6" fill="currentColor" />
        }
        @case ('roundabout') {
          <circle cx="24" cy="29" r="11" fill="none" stroke="currentColor" stroke-width="5" />
          <path d="M24 3 L34 15 H14 Z" fill="currentColor" />
        }
        @default {
          <path
            d="M24 4 L40 22 H30 V44 H18 V22 H8 Z"
            fill="currentColor"
            [attr.transform]="transform()"
          />
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: block;
      width: 56px;
      height: 56px;
      flex: none;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
})
export class CueArrow {
  readonly kind = input.required<CueKind>();
  protected readonly transform = computed(() => `rotate(${ROTATION[this.kind()]} 24 24)`);
}
