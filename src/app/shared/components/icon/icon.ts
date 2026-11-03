import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconName, ICONS } from './icons';

/**
 * Ein Icon aus dem festen Satz in `icons.ts`. Rein dekorativ (`aria-hidden`): die Bedeutung
 * trägt immer ein Text oder ein `aria-label` am Knopf drumherum.
 */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      [attr.width]="size()"
      [attr.height]="size()"
      [attr.stroke-width]="stroke()"
    >
      <path [attr.d]="path()" />
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
      line-height: 0;
    }
  `,
})
export class Icon {
  name = input.required<IconName>();
  size = input(18);
  stroke = input(1.75);

  path = computed(() => ICONS[this.name()]);
}
