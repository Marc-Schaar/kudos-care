import { Component, computed, input } from '@angular/core';
import { WarnStatus } from '../../models/maintenance.models';
import { WarnClassPipe } from '../../pipes/warn-class/warn-class-pipe';
import { ratioPercent } from '../../shared/utils/utils';

/** Der Balken, der zeigt, wie viel von der Lebensdauer verbraucht ist. */
@Component({
  selector: 'app-wear-meter',
  imports: [WarnClassPipe],
  template: `
    <div class="meter" aria-hidden="true">
      <div class="fill" [class]="status() | warnClass" [style.width.%]="percent()"></div>
    </div>
  `,
  styles: `
    .meter {
      height: 0.3rem;
      overflow: hidden;
      background: var(--border);
      border-radius: 999px;
    }

    .fill {
      height: 100%;
      background: var(--muted);
      border-radius: inherit;
    }

    .fill.status-ok {
      background: var(--ok);
    }

    .fill.status-warn {
      background: var(--warn);
    }

    .fill.status-critical {
      background: var(--critical);
    }
  `,
})
export class WearMeter {
  ratio = input<number | null | undefined>(null);
  status = input<WarnStatus>('unknown');

  percent = computed(() => ratioPercent(this.ratio()));
}
