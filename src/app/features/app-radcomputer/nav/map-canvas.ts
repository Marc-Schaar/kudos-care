import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';

import { mercX, mercY } from '../core/geo';
import { GpsFix, MapStyle, Theme } from '../core/models';
import { NavRoute } from './nav-models';

const TILE = 256;
const MAX_TILES = 160;

interface TileSource {
  url: (z: number, x: number, y: number) => string;
  /** Darüber werden die Kacheln dieser Stufe vergrößert statt neu geladen. */
  maxZoom: number;
  attribution: string;
}

/** Lastverteilung über die Unterdomains a/b/c, gleichmäßig je Kachel. */
const sub = (x: number, y: number): string => 'abc'[(x + y) % 3];

/**
 * Kartenbilder ohne API-Schlüssel. CyclOSM zeigt Radwege, Radstreifen, Belag und
 * Radinfrastruktur; OpenTopoMap Höhenlinien und Schummerung für Gravel und Gelände.
 */
export const TILE_SOURCES: Record<MapStyle, TileSource> = {
  osm: {
    url: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
    maxZoom: 19,
    attribution: '© OpenStreetMap',
  },
  cyclosm: {
    url: (z, x, y) =>
      `https://${sub(x, y)}.tile-cyclosm.openstreetmap.fr/cyclosm/${z}/${x}/${y}.png`,
    maxZoom: 20,
    attribution: '© OpenStreetMap · CyclOSM',
  },
  topo: {
    url: (z, x, y) => `https://${sub(x, y)}.tile.opentopomap.org/${z}/${x}/${y}.png`,
    maxZoom: 17,
    attribution: '© OpenStreetMap · SRTM · OpenTopoMap',
  },
};

/**
 * Karte auf zwei Canvas-Ebenen: unten Kartenkacheln (nachts per CSS-Filter abgedunkelt),
 * oben Route und Standort. Ohne Kacheln bleibt die Routenlinie, das genügt zum
 * Nachfahren und funktioniert ohne Netz.
 */
@Component({
  selector: 'rc-map',
  template: `
    <canvas #tiles class="tiles" [class.night]="theme() === 'night'" aria-hidden="true"></canvas>
    <canvas #overlay role="img" [attr.aria-label]="label()"></canvas>
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      overflow: hidden;
      background: var(--panel);
    }
    canvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }
    .tiles.night {
      filter: invert(1) hue-rotate(180deg) brightness(0.8) contrast(0.9);
    }
  `,
})
export class MapCanvas {
  readonly route = input<NavRoute | null>(null);
  /** Bis zu diesem Routenpunkt ist die Strecke schon gefahren. */
  readonly passedIndex = input(0);
  readonly position = input<GpsFix | null>(null);
  readonly heading = input<number | null>(null);
  readonly headingUp = input(true);
  readonly showTiles = input(true);
  readonly tileStyle = input<MapStyle>('cyclosm');
  readonly zoom = input(16);
  readonly theme = input<Theme>('night');
  readonly label = input('Karte');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly tilesRef = viewChild.required<ElementRef<HTMLCanvasElement>>('tiles');
  private readonly overlayRef = viewChild.required<ElementRef<HTMLCanvasElement>>('overlay');
  private readonly size = signal({ w: 0, h: 0, dpr: 1 });
  private readonly tilesLoaded = signal(0);
  private readonly tileCache = new Map<string, HTMLImageElement>();
  private frame = 0;

  /** Routenpunkte einmal in Mercator umrechnen, nicht bei jedem Bild. */
  private readonly projected = computed(() => {
    const route = this.route();
    if (!route) return null;
    const out = new Float64Array(route.points.length * 2);
    route.points.forEach((p, i) => {
      out[2 * i] = mercX(p.lon);
      out[2 * i + 1] = mercY(p.lat);
    });
    return out;
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const el = this.host.nativeElement;
      const measure = (): void =>
        this.size.set({
          w: el.clientWidth,
          h: el.clientHeight,
          dpr: Math.min(3, window.devicePixelRatio || 1),
        });
      const observer = new ResizeObserver(measure);
      observer.observe(el);
      measure();
      destroyRef.onDestroy(() => {
        observer.disconnect();
        cancelAnimationFrame(this.frame);
      });
    });

    effect(() => {
      // Alles lesen, was das Bild bestimmt: jede Änderung zeichnet neu.
      this.projected();
      this.passedIndex();
      this.position();
      this.heading();
      this.headingUp();
      this.showTiles();
      this.tileStyle();
      this.zoom();
      this.theme();
      this.size();
      this.tilesLoaded();
      if (!this.frame) this.frame = requestAnimationFrame(() => this.draw());
    });
  }

  private tile(source: TileSource, z: number, x: number, y: number): HTMLImageElement {
    const src = source.url(z, x, y);
    let img = this.tileCache.get(src);
    if (!img) {
      img = new Image();
      img.decoding = 'async';
      img.onload = () => this.tilesLoaded.update((n) => n + 1);
      img.src = src;
      this.tileCache.set(src, img);
      if (this.tileCache.size > MAX_TILES) {
        const oldest = this.tileCache.keys().next().value;
        if (oldest !== undefined) this.tileCache.delete(oldest);
      }
    }
    return img;
  }

  private draw(): void {
    this.frame = 0;
    const { w, h, dpr } = this.size();
    if (!w || !h) return;
    const tilesEl = this.tilesRef().nativeElement;
    const overlayEl = this.overlayRef().nativeElement;
    for (const el of [tilesEl, overlayEl]) {
      if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) {
        el.width = Math.round(w * dpr);
        el.height = Math.round(h * dpr);
      }
    }
    const tctx = tilesEl.getContext('2d');
    const ctx = overlayEl.getContext('2d');
    if (!tctx || !ctx) return;
    tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    tctx.clearRect(0, 0, w, h);
    ctx.clearRect(0, 0, w, h);

    const route = this.route();
    const pos = this.position();
    const center = pos ?? route?.points[0];
    if (!center) return;

    const z = this.zoom();
    const scale = TILE * 2 ** z;
    const cx = mercX(center.lon) * scale;
    const cy = mercY(center.lat) * scale;
    const heading = this.heading();
    const up = this.headingUp() && pos != null && heading != null;
    const rot = up ? (-heading * Math.PI) / 180 : 0;
    // In Fahrtrichtung sitzt der Standort im unteren Drittel: mehr Sicht nach vorn.
    const ox = w / 2;
    const oy = up ? h * 0.66 : h / 2;
    const radius = Math.hypot(Math.max(ox, w - ox), Math.max(oy, h - oy));
    const css = getComputedStyle(this.host.nativeElement);
    const fg = css.getPropertyValue('--fg').trim() || '#fff';
    const bg = css.getPropertyValue('--bg').trim() || '#000';
    const muted = css.getPropertyValue('--muted').trim() || '#999';

    if (this.showTiles()) {
      // Über der höchsten Stufe des Dienstes die Kacheln darunter vergrößern.
      const source = TILE_SOURCES[this.tileStyle()] ?? TILE_SOURCES.osm;
      const tz = Math.min(z, source.maxZoom);
      const size = TILE * 2 ** (z - tz);
      tctx.translate(ox, oy);
      tctx.rotate(rot);
      const n = 2 ** tz;
      for (
        let tx = Math.floor((cx - radius) / size);
        tx <= Math.floor((cx + radius) / size);
        tx++
      ) {
        for (
          let ty = Math.floor((cy - radius) / size);
          ty <= Math.floor((cy + radius) / size);
          ty++
        ) {
          if (ty < 0 || ty >= n) continue;
          const img = this.tile(source, tz, ((tx % n) + n) % n, ty);
          // Ein Pixel Überlappung verdeckt die Nähte beim Drehen.
          if (img.complete && img.naturalWidth)
            tctx.drawImage(img, tx * size - cx, ty * size - cy, size + 1, size + 1);
        }
      }
    }

    ctx.translate(ox, oy);
    ctx.rotate(rot);
    const m = this.projected();
    if (route && m) {
      const lim = radius + 40;
      const last = route.points.length - 1;
      const passed = Math.min(this.passedIndex(), last);
      const stroke = (
        from: number,
        to: number,
        color: string,
        width: number,
        dash: number[],
      ): void => {
        ctx.beginPath();
        let pen = false;
        for (let i = from; i < to; i++) {
          const ax = m[2 * i] * scale - cx;
          const ay = m[2 * i + 1] * scale - cy;
          const bx = m[2 * i + 2] * scale - cx;
          const by = m[2 * i + 3] * scale - cy;
          if (
            (ax < -lim && bx < -lim) ||
            (ax > lim && bx > lim) ||
            (ay < -lim && by < -lim) ||
            (ay > lim && by > lim)
          ) {
            pen = false;
            continue;
          }
          if (!pen) ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          pen = true;
        }
        ctx.setLineDash(dash);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();
      };
      // Gefahrener Teil gestrichelt und blasser, der Rest kräftig mit Rand in Hintergrundfarbe.
      stroke(0, passed, bg, 8, []);
      stroke(0, passed, muted, 4, [2, 9]);
      stroke(passed, last, bg, 10, []);
      stroke(passed, last, fg, 5, []);

      ctx.setLineDash([]);
      for (const cue of route.cues) {
        if (cue.index <= passed) continue;
        const x = m[2 * cue.index] * scale - cx;
        const y = m[2 * cue.index + 1] * scale - cy;
        if (Math.abs(x) > lim || Math.abs(y) > lim) continue;
        const end = cue.kind === 'arrive';
        ctx.beginPath();
        ctx.arc(x, y, end ? 10 : 6, 0, Math.PI * 2);
        ctx.fillStyle = end ? fg : bg;
        ctx.fill();
        ctx.strokeStyle = end ? bg : fg;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }

    if (pos) {
      // Standortpfeil: zeigt nach oben (Fahrtrichtung) oder in Kursrichtung (Norden oben).
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.translate(ox, oy);
      if (!up && heading != null) ctx.rotate((heading * Math.PI) / 180);
      ctx.beginPath();
      ctx.moveTo(0, -17);
      ctx.lineTo(12, 13);
      ctx.lineTo(0, 6);
      ctx.lineTo(-12, 13);
      ctx.closePath();
      ctx.fillStyle = fg;
      ctx.fill();
      ctx.strokeStyle = bg;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
}
