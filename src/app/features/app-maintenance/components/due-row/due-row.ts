import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RouteCommands } from '../../../../shared/services/navigation-service/navigation-service';
import { WarnClassPipe } from '../../pipes/warn-class/warn-class-pipe';
import { DueItem, weatherSurplusKm } from '../../shared/utils/utils';
import { WearMeter } from '../wear-meter/wear-meter';

/**
 * Eine Zeile "Als Nächstes dran": was, wo, wie weit noch. Mit `link` führt die Zeile zur Baugruppe
 * (Startseite), ohne ihn meldet sie `opened` und die Seite öffnet ein Blatt (Rad-Seite).
 */
@Component({
  selector: 'app-due-row',
  imports: [DecimalPipe, NgTemplateOutlet, RouterLink, WarnClassPipe, WearMeter],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #body>
      <span class="g-dot dot" [class]="item().status | warnClass"></span>
      <span class="g-row-main">
        <span class="head">
          <span class="g-row-title">{{ item().title }}</span>
          @if (item().remaining) {
            <span
              class="g-num remaining"
              [class.over]="item().status === 'critical'"
              [class.soon]="item().status === 'warn'"
              >{{ item().remaining }}</span
            >
          }
        </span>
        <span class="g-row-sub">
          {{ item().where }} · {{ item().detail }}
          @if (weatherKm(); as km) {
            · <span class="weather">mit Wetter {{ km | number: '1.0-0' }} km</span>
          }
        </span>
        @if (item().component; as part) {
          <app-wear-meter class="meter" [part]="part" />
        } @else {
          <app-wear-meter class="meter" [ratio]="item().ratio" [status]="item().status" />
        }
      </span>
    </ng-template>

    @if (link(); as commands) {
      <a class="g-row row" [routerLink]="commands">
        <ng-container [ngTemplateOutlet]="body" />
      </a>
    } @else {
      <button type="button" class="g-row row" (click)="opened.emit()">
        <ng-container [ngTemplateOutlet]="body" />
      </button>
    }

    @if (item().interval) {
      <button type="button" class="g-btn small done" (click)="done.emit()">Erledigt</button>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
    }

    .row {
      flex: 1 1 100%;
      min-width: 0;
      align-items: flex-start;
    }

    .dot {
      margin-top: 0.35rem;
    }

    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: 0 0.75rem;
    }

    .remaining {
      flex: none;
      font-size: var(--t-sm);
      font-weight: 500;
      color: var(--text);
    }

    .remaining.soon {
      font-weight: 600;
      color: var(--warn);
    }

    .remaining.over {
      font-weight: 600;
      color: var(--critical);
    }

    .weather {
      color: var(--rain);
      white-space: nowrap;
    }

    .meter {
      margin-top: 0.4rem;
    }

    .done {
      flex: none;
      margin: -0.25rem 0 0.7rem 2.3rem;
    }

    @media (min-width: 640px) {
      :host {
        flex-wrap: nowrap;
      }

      .row {
        flex: 1 1 auto;
      }

      .done {
        margin: 0 0.75rem 0 0;
      }
    }
  `,
})
export class DueRow {
  item = input.required<DueItem>();
  link = input<RouteCommands | null>(null);
  opened = output<void>();
  done = output<void>();

  weatherKm = computed(() => {
    const part = this.item().component;
    return part && weatherSurplusKm(part) !== null ? part.weather_wear_km : null;
  });
}
