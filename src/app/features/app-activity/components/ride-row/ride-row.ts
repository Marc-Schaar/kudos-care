import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../../../shared/components/icon/icon';
import { NavigationService } from '../../../../shared/services/navigation-service/navigation-service';
import { Activity } from '../../../../shared/services/strava-service/strava-service';
import { formatDuration, rideKm, rideWeather } from '../../models/ride-insights';
import { RouteGlyph } from '../route-glyph/route-glyph';

/** Eine Fahrt als Zeile: auf der Startseite und in der Fahrtenliste dieselbe. */
@Component({
  selector: 'app-ride-row',
  imports: [DatePipe, DecimalPipe, Icon, RouterLink, RouteGlyph],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="g-row ride" [routerLink]="nav.to.activity(ride().id)">
      <app-route-glyph [track]="ride().track" />
      <span class="g-row-main">
        <span class="g-row-title name">{{ ride().name }}</span>
        <span class="g-row-sub">
          @if (ride().start_date) {
            {{ ride().start_date | date: 'EEE, d. MMM' }}
          }
          @if (ride().elapsed_time) {
            · {{ duration() }}
          }
        </span>
      </span>
      @if (weather(); as w) {
        <span class="weather">
          @if (w.wet) {
            <span class="wet">
              <app-icon name="droplets" [size]="15" />
              <span class="sr">nass</span>
            </span>
          }
          @if (w.avgTemperature !== null) {
            <span class="g-num temp">{{ w.avgTemperature | number: '1.0-0' }} °C</span>
          }
        </span>
      }
      <span class="g-num km">{{ km() | number: '1.0-1' }} km</span>
    </a>
  `,
  styles: `
    :host {
      display: block;
      /* Lange Listen: Zeilen außerhalb des Bilds werden gar nicht erst gezeichnet. */
      content-visibility: auto;
      contain-intrinsic-size: auto 3.75rem;
    }

    .name {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    .weather {
      flex: none;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: var(--t-sm);
      color: var(--muted);
    }

    .temp {
      display: none;
    }

    .wet {
      display: inline-flex;
      color: var(--rain);
    }

    .sr {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }

    .km {
      flex: none;
      min-width: 4.5rem;
      font-size: var(--t-sm);
      font-weight: 500;
      text-align: right;
    }

    @media (min-width: 640px) {
      .temp {
        display: inline;
        min-width: 3rem;
        text-align: right;
      }
    }
  `,
})
export class RideRow {
  readonly nav = inject(NavigationService);

  ride = input.required<Activity>();

  km = computed(() => rideKm(this.ride()));
  duration = computed(() => formatDuration(this.ride().elapsed_time));
  weather = computed(() => rideWeather(this.ride()));
}
