import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DASH, fmtDistance, num } from '../core/format';
import { Gps } from '../core/gps';
import { Heading } from '../core/heading';
import { RideRecorder } from '../core/ride-recorder';
import { RideView } from '../core/ride-view';
import { SettingsStore } from '../core/settings-store';
import { Ticker } from '../core/ticker';
import { Compass } from './compass';
import { CueSign } from './cue-sign';
import { MapCanvas, TILE_SOURCES } from './map-canvas';
import {
  MAX_ZOOM,
  MIN_ZOOM,
  MapCamera,
  SpeedZoom,
  cameraAt,
  clampZoom,
  zoomForSpeed,
} from './map-camera';
import { BellButton } from '../ride/bell-button';
import { RouteGuide } from './route-guide';
import { RC } from '../core/paths';
import { WindBadge } from '../wind/wind-badge';

/** Verschobene Karte kehrt zum Standort zurück, wenn man so lange nicht eingreift (ms) … */
const RETURN_AFTER_MS = 20000;
/** … und dabei fährt (m/s, rund 7 km/h). Im Stand bleibt sie, wo man sie hingeschoben hat. */
const RETURN_MIN_SPEED = 2;

/**
 * Kartenseite der Fahrt: nächster Hinweis, Karte, drei Werte. Routen wählt man im Menü.
 * Die Karte folgt dem Standort und zoomt nach Tempo, bis man sie verschiebt, dreht oder
 * zoomt; dann erscheint „Zentrieren“.
 */
@Component({
  selector: 'rc-map-view',
  imports: [MapCanvas, CueSign, Compass, RouterLink, WindBadge, BellButton],
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
        [heading]="heading.value()"
        [camera]="camera()"
        (cameraChange)="onUserCamera($event)"
        [showTiles]="settings.value().mapTiles"
        [tileStyle]="settings.value().mapStyle"
        [theme]="settings.value().theme"
        [label]="mapLabel()"
      />
      <rc-wind-badge class="wind" [bearing]="bearing()" />
      <div class="map-buttons">
        <rc-compass
          [bearing]="bearing()"
          [headingUp]="settings.value().headingUp"
          (toggle)="toggleHeadingUp()"
        />
        <button
          type="button"
          class="map-btn"
          (click)="zoomBy(1)"
          [disabled]="zoom() >= maxZoom"
          aria-label="Karte vergrößern"
        >
          +
        </button>
        <button
          type="button"
          class="map-btn"
          (click)="zoomBy(-1)"
          [disabled]="zoom() <= minZoom"
          aria-label="Karte verkleinern"
        >
          −
        </button>
        <rc-bell variant="map" />
      </div>
      @if (detached()) {
        <button
          type="button"
          class="recenter"
          (click)="recenter()"
          aria-label="Zentrieren: zurück zum Standort, Zoom wieder nach Tempo"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M2 12h3M19 12h3M12 2v3M12 19v3" />
            <circle cx="12" cy="12" r="7" />
            <circle class="dot" cx="12" cy="12" r="3" />
          </svg>
          Zentrieren
        </button>
      }
      @if (settings.value().mapTiles) {
        <a
          class="attribution"
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener"
          >{{ attribution() }}</a
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
    /* Über der Quellenangabe, mittig: dort liegt der Daumen, und die Tastenspalte bleibt frei. */
    .recenter {
      position: absolute;
      left: 50%;
      bottom: 30px;
      transform: translateX(-50%);
      min-height: 56px;
      padding: 0 18px 0 14px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: 2px solid var(--fg);
      border-radius: 4px;
      background: var(--bg);
      font-family: var(--digits);
      font-size: var(--t-l);
      font-weight: 700;
      white-space: nowrap;
    }
    .recenter svg {
      width: 26px;
      height: 26px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.25;
      stroke-linecap: round;
    }
    .recenter .dot {
      fill: currentColor;
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
  protected readonly heading = inject(Heading);
  private readonly ride = inject(RideRecorder);
  private readonly ticker = inject(Ticker);
  private readonly view = inject(RideView);
  private readonly speedZoom = new SpeedZoom();
  private readonly autoZoom = signal(zoomForSpeed(0));

  protected readonly minZoom = MIN_ZOOM;
  protected readonly maxZoom = MAX_ZOOM;

  /** Mitfahren: Standort (ohne GPS der Routenstart), Zoom nach Tempo oder von Hand. */
  private readonly followCamera = computed<MapCamera | null>(() => {
    const pos = this.gps.fix();
    const center = pos ?? this.guide.route()?.points[0];
    if (!center) return null;
    const heading = this.heading.value();
    const up = this.settings.value().headingUp && pos && heading != null ? heading : null;
    // In Fahrtrichtung sitzt der Standort im unteren Drittel: mehr Sicht nach vorn.
    return cameraAt(
      center.lat,
      center.lon,
      this.view.mapZoom() ?? this.autoZoom(),
      up ?? 0,
      up != null ? 0.66 : 0.5,
    );
  });
  protected readonly camera = computed(() => this.view.mapFree() ?? this.followCamera());
  protected readonly zoom = computed(() => this.camera()?.zoom ?? this.autoZoom());
  /** Drehung der Karte: danach richten sich Kompassnadel und Windpfeil. */
  protected readonly bearing = computed(() => this.camera()?.bearing ?? 0);
  protected readonly detached = computed(
    () => this.view.mapFree() != null || this.view.mapZoom() != null,
  );

  protected readonly attribution = computed(
    () => (TILE_SOURCES[this.settings.value().mapStyle] ?? TILE_SOURCES.osm).attribution,
  );

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
    // Der Takt hält die Glättung auch ohne neue Position in Gang (veraltet = Stillstand).
    effect(() => {
      this.ticker.now();
      this.autoZoom.set(this.speedZoom.update(this.gps.speed(), Date.now()));
    });
    effect(() => {
      const now = this.ticker.now();
      if (
        this.view.mapFree() &&
        (this.gps.speed() ?? 0) > RETURN_MIN_SPEED &&
        now - this.view.mapTouchedAt > RETURN_AFTER_MS
      )
        this.view.recenterMap();
    });
  }

  protected onUserCamera(cam: MapCamera | null): void {
    if (!cam) return;
    this.view.mapFree.set(cam);
    this.view.mapTouchedAt = Date.now();
  }

  protected recenter(): void {
    this.view.recenterMap();
  }

  /** Ganze Stufen, damit die Kacheln scharf bleiben. Beim Mitfahren bleibt die Karte dran. */
  protected zoomBy(delta: number): void {
    const z = this.zoom();
    const next = clampZoom(delta > 0 ? Math.floor(z + 1e-6) + delta : Math.ceil(z - 1e-6) + delta);
    const free = this.view.mapFree();
    if (free) {
      this.view.mapFree.set({ ...free, zoom: next });
      this.view.mapTouchedAt = Date.now();
    } else {
      this.view.mapZoom.set(next);
    }
  }

  /**
   * Der Tipp auf den Kompass holt auf dem iPhone auch die Erlaubnis für den Kompass. Eine
   * von Hand gedrehte Karte richtet er dabei gleich mit aus.
   */
  protected toggleHeadingUp(): void {
    const headingUp = !this.settings.value().headingUp;
    if (headingUp) this.heading.enable();
    this.settings.patch({ headingUp });
    const free = this.view.mapFree();
    if (free)
      this.view.mapFree.set({ ...free, bearing: headingUp ? (this.heading.value() ?? 0) : 0 });
  }
}
