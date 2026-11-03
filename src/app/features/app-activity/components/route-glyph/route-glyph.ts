import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { routePath } from '../../models/ride-insights';

/**
 * Die Form der Strecke als kleines Zeichen. Eine Hausrunde erkennt man an ihrer Form schneller
 * als an "Morgenfahrt" oder dem Datum, gerade wenn Strava zwanzig Fahrten gleich benennt.
 */
@Component({
  selector: 'app-route-glyph',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 48 48" aria-hidden="true">
      @if (path(); as d) {
        <svg:path class="route" [attr.d]="d" />
      } @else {
        <svg:path class="none" d="M12 24h24" />
      }
    </svg>
  `,
  styles: `
    :host {
      display: block;
      flex: none;
      width: 2.5rem;
      height: 2.5rem;
    }

    svg {
      display: block;
      width: 100%;
      height: 100%;
    }

    path {
      fill: none;
      stroke-width: 1.75;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .route {
      stroke: var(--muted);
    }

    .none {
      stroke: var(--border-strong);
      stroke-dasharray: 2 4;
    }
  `,
})
export class RouteGlyph {
  track = input<string | null | undefined>(null);

  path = computed(() => routePath(this.track()));
}
