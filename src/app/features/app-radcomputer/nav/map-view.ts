import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DASH, fmtDistance, num } from '../core/format';
import { Gps } from '../core/gps';
import { RideRecorder } from '../core/ride-recorder';
import { RideView } from '../core/ride-view';
import { SettingsStore } from '../core/settings-store';
import { Ticker } from '../core/ticker';
import { Compass } from './compass';
import { CueSign } from './cue-sign';
import { MapCanvas } from './map-canvas';
import { RouteGuide } from './route-guide';
import { RC } from '../core/paths';
import { WindBadge } from '../wind/wind-badge';

/** Kartenseite der Fahrt: nächster Hinweis, Karte, drei Werte. Routen wählt man im Menü. */
@Component({
  selector: 'rc-map-view',
  imports: [MapCanvas, CueSign, Compass, RouterLink, WindBadge],
  template: `
    <div class="banner">
      @if (guide.route(); as route) {
        @if (guide.progress(); as p) {
          @if (p.offRoute) {
            <rc-cue-sign
              size="large"
              kind="uturn"
              [off]="true"
              [distance]="offDistance()"
              text="Route verlassen. So weit ist sie entfernt."
            />
          } @else if (p.nextCue; as cue) {
            <rc-cue-sign
              size="large"
              [kind]="cue.kind"
              [distance]="cueDistance()"
              [text]="p.arrived ? 'Ziel erreicht' : cue.text"
            />
          }
        } @else {
          <p class="banner-text">{{ route.name }}: warte auf GPS.</p>
        }
      } @else if (guide.busy()) {
        <p class="banner-text">Route wird berechnet …</p>
      } @else {
        <p class="banner-text">Keine Route geladen. <a [routerLink]="rc.route">Route wählen</a></p>
      }
    </div>

    <div class="map-wrap">
      <rc-map
        [route]="guide.route()"
        [passedIndex]="guide.progress()?.index ?? 0"
        [position]="gps.fix()"
        [heading]="gps.heading()"
        [headingUp]="settings.value().headingUp"
        [showTiles]="settings.value().mapTiles"
        [zoom]="zoom()"
        [theme]="settings.value().theme"
        [label]="mapLabel()"
      />
      <rc-wind-badge class="wind" [headingUp]="settings.value().headingUp" />
      <div class="map-buttons">
        <rc-compass
          [heading]="gps.heading()"
          [headingUp]="settings.value().headingUp"
          (toggle)="toggleHeadingUp()"
        />
        <button
          type="button"
          class="map-btn"
          (click)="zoomBy(1)"
          [disabled]="zoom() >= 18"
          aria-label="Karte vergrößern"
        >
          +
        </button>
        <button
          type="button"
          class="map-btn"
          (click)="zoomBy(-1)"
          [disabled]="zoom() <= 12"
          aria-label="Karte verkleinern"
        >
          −
        </button>
      </div>
      @if (settings.value().mapTiles) {
        <a
          class="attribution"
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener"
          >© OpenStreetMap</a
        >
      }
    </div>

    <dl class="strip">
      <div>
        <dt>Tempo <span>km/h</span></dt>
        <dd class="digits">{{ speed() }}</dd>
      </div>
      <div>
        <dt>Rest</dt>
        <dd class="digits">{{ remaining() }}</dd>
      </div>
      <div>
        <dt>Ankunft</dt>
        <dd class="digits">{{ eta() }}</dd>
      </div>
    </dl>
  `,
  styles: `
    :host {
      height: 100%;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
    }
    .banner {
      padding: 6px;
      border-bottom: 1px solid var(--line);
    }
    .banner-text {
      min-height: 64px;
      padding: 0 8px;
      display: flex;
      align-items: center;
      font-family: var(--digits);
      font-size: var(--t-l);
      font-weight: 700;
      line-height: 1.25;
    }
    .banner-text a {
      margin-left: 0.4em;
      text-underline-offset: 3px;
      text-decoration-thickness: 2px;
    }
    .map-wrap {
      position: relative;
      min-height: 0;
    }
    rc-map {
      position: absolute;
      inset: 0;
    }
    .wind {
      position: absolute;
      left: 8px;
      top: 8px;
    }
    .map-buttons {
      position: absolute;
      right: 8px;
      top: 8px;
      display: grid;
      gap: 8px;
      justify-items: center;
    }
    .map-btn {
      width: 56px;
      height: 56px;
      border: 2px solid var(--fg);
      border-radius: 4px;
      background: var(--bg);
      font-family: var(--digits);
      font-size: 30px;
      font-weight: 700;
      line-height: 1;
    }
    .map-btn:disabled {
      opacity: 0.4;
    }
    .attribution {
      position: absolute;
      left: 0;
      bottom: 0;
      padding: 4px 8px;
      font-size: 11px;
      line-height: 14px;
      background: var(--bg);
      color: var(--muted);
      text-decoration: none;
      border-top-right-radius: 6px;
    }
    .strip {
      margin: 0;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      border-top: 1px solid var(--line);
    }
    .strip > div {
      padding: 6px var(--gutter) 8px;
      border-left: 1px solid var(--line);
      min-width: 0;
    }
    .strip > div:first-child {
      border-left: 0;
    }
    .strip dt {
      font-family: var(--digits);
      font-size: var(--t-m);
      font-weight: 700;
      color: var(--muted);
      display: flex;
      justify-content: space-between;
    }
    .strip dd {
      margin: 2px 0 0;
      font-size: 32px;
      line-height: 1;
      white-space: nowrap;
    }
  `,
})
export class MapView {
  protected readonly rc = RC;
  protected readonly guide = inject(RouteGuide);
  protected readonly gps = inject(Gps);
  protected readonly settings = inject(SettingsStore);
  private readonly ride = inject(RideRecorder);
  private readonly ticker = inject(Ticker);

  protected readonly zoom = inject(RideView).mapZoom;

  protected readonly remaining = computed(() => {
    const p = this.guide.progress();
    return p ? fmtDistance(p.remainingM) : DASH;
  });
  protected readonly speed = computed(() => {
    const v = this.gps.speed();
    return num(v == null ? null : v * 3.6, 1);
  });
  /** Ankunftszeit aus dem bisherigen Schnitt, ersatzweise aus dem aktuellen Tempo. */
  protected readonly eta = computed(() => {
    const p = this.guide.progress();
    const stats = this.ride.stats();
    const avg =
      stats.movingMs > 60000 ? stats.distanceM / (stats.movingMs / 1000) : this.gps.speed();
    if (!p || avg == null || avg < 1.5) return DASH;
    return new Date(this.ticker.now() + (p.remainingM / avg) * 1000).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    });
  });
  protected readonly offDistance = computed(() => fmtDistance(this.guide.progress()?.offM ?? 0));
  protected readonly cueDistance = computed(() => {
    const d = this.guide.progress()?.cueDistM;
    return d == null ? DASH : fmtDistance(d);
  });
  protected readonly mapLabel = computed(() => {
    const route = this.guide.route();
    return route
      ? `Karte mit Route ${route.name}. Hinweise und Entfernungen stehen als Text darüber und darunter.`
      : 'Karte ohne Route';
  });

  constructor() {
    this.gps.start();
  }

  protected zoomBy(delta: number): void {
    this.zoom.update((z) => Math.min(18, Math.max(12, z + delta)));
  }

  protected toggleHeadingUp(): void {
    this.settings.patch({ headingUp: !this.settings.value().headingUp });
  }
}
