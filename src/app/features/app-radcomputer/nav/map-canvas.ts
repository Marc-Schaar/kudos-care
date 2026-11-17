import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';

import { mercX, mercY } from '../core/geo';
import { GpsFix, MapStyle, Theme } from '../core/models';
import {
  MapCamera,
  MercBounds,
  ScreenPoint,
  TILE,
  Viewport,
  fitCamera,
  panCamera,
  pinchCamera,
  twist,
  worldToScreen,
  zoomAt,
} from './map-camera';
import { NavRoute } from './nav-models';

const MAX_TILES = 160;
/** So weit darf ein Finger wandern, bevor aus dem Tipp ein Verschieben wird (px). */
const TAP_SLOP = 8;
/** Erst ab dieser Verdrehung dreht die Karte (Grad), sonst kippt sie beim Zoomen mit. */
const ROTATE_START_DEG = 12;
/** Unterhalb dieser Stufe nur noch Start und Ziel, sonst wird die Übersicht zur Perlenkette. */
const CUE_MIN_ZOOM = 13;

interface Gesture {
  /** Kamera und Fingerpositionen zu Beginn bzw. seit dem letzten Fingerwechsel */
  cam: MapCamera;
  pts: ScreenPoint[];
  rotating: boolean;
}

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
 *
 * Was sie zeigt, bestimmt `camera`; ohne Kamera zeigt sie die ganze Route. Ein Finger
 * verschiebt, zwei zoomen und drehen, das Mausrad zoomt. Jede Geste setzt `camera` und
 * meldet sie über `cameraChange`, die Seite entscheidet, was daraus folgt.
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
    :host(.interactive) {
      touch-action: none;
      cursor: grab;
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
  host: {
    '[class.interactive]': 'interactive()',
    '(pointerdown)': 'onPointerDown($event)',
    '(pointermove)': 'onPointerMove($event)',
    '(pointerup)': 'onPointerUp($event)',
    '(pointercancel)': 'onPointerUp($event)',
    '(wheel)': 'onWheel($event)',
    '(click)': 'onClick($event)',
  },
})
export class MapCanvas {
  readonly route = input<NavRoute | null>(null);
  /** Bis zu diesem Routenpunkt ist die Strecke schon gefahren. */
  readonly passedIndex = input(0);
  readonly position = input<GpsFix | null>(null);
  /** Kurs des Standortpfeils in Grad; die Drehung der Karte steckt in `camera`. */
  readonly heading = input<number | null>(null);
  /** `null` = die ganze Route, Norden oben. */
  readonly camera = model<MapCamera | null>(null);
  readonly interactive = input(true);
  readonly showTiles = input(true);
  readonly tileStyle = input<MapStyle>('cyclosm');
  readonly theme = input<Theme>('night');
  readonly label = input('Karte');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly tilesRef = viewChild.required<ElementRef<HTMLCanvasElement>>('tiles');
  private readonly overlayRef = viewChild.required<ElementRef<HTMLCanvasElement>>('overlay');
  private readonly size = signal({ w: 0, h: 0, dpr: 1 });
  private readonly tilesLoaded = signal(0);
  private readonly tileCache = new Map<string, HTMLImageElement>();
  private frame = 0;
  /** Die zuletzt gezeichnete Kamera: davon geht jede Geste aus, auch in der Übersicht. */
  private lastCamera: MapCamera | null = null;
  private readonly pointers = new Map<number, ScreenPoint>();
  private gesture: Gesture | null = null;
  private downAt: ScreenPoint | null = null;
  /** Nach einem Verschieben ist das folgende `click` kein Tipp auf die Karte. */
  private moved = false;

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

  private readonly bounds = computed<MercBounds | null>(() => {
    const m = this.projected();
    if (!m) return null;
    const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    for (let i = 0; i < m.length; i += 2) {
      b.minX = Math.min(b.minX, m[i]);
      b.maxX = Math.max(b.maxX, m[i]);
      b.minY = Math.min(b.minY, m[i + 1]);
      b.maxY = Math.max(b.maxY, m[i + 1]);
    }
    return b;
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
      this.camera();
      this.showTiles();
      this.tileStyle();
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
    const cam = this.effectiveCamera({ w, h });
    this.lastCamera = cam;
    if (!cam) return;

    const z = cam.zoom;
    const scale = TILE * 2 ** z;
    const cx = cam.x * scale;
    const cy = cam.y * scale;
    const rot = (-cam.bearing * Math.PI) / 180;
    const ox = w / 2;
    const oy = h * cam.anchorY;
    const radius = Math.hypot(Math.max(ox, w - ox), Math.max(oy, h - oy));
    const css = getComputedStyle(this.host.nativeElement);
    const fg = css.getPropertyValue('--fg').trim() || '#fff';
    const bg = css.getPropertyValue('--bg').trim() || '#000';
    const muted = css.getPropertyValue('--muted').trim() || '#999';

    if (this.showTiles()) {
      // Kachelstufe gerundet (Pinch liefert Bruchteile); über der höchsten Stufe des
      // Dienstes die Kacheln darunter vergrößern.
      const source = TILE_SOURCES[this.tileStyle()] ?? TILE_SOURCES.osm;
      const tz = Math.max(0, Math.min(Math.round(z), source.maxZoom));
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
      if (passed === 0) {
        // Start als Ring: in der Übersicht sieht man, wo die Route beginnt.
        const x = m[0] * scale - cx;
        const y = m[1] * scale - cy;
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.fillStyle = bg;
        ctx.fill();
        ctx.strokeStyle = fg;
        ctx.lineWidth = 4;
        ctx.stroke();
      }
      const showCues = z >= CUE_MIN_ZOOM;
      for (const cue of route.cues) {
        if (cue.index <= passed) continue;
        if (!showCues && cue.kind !== 'arrive') continue;
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
      // Standortpfeil in Kursrichtung, relativ zur Drehung der Karte: bei Fahrtrichtung
      // oben zeigt er also nach oben.
      const at = worldToScreen(cam, { w, h }, mercX(pos.lon), mercY(pos.lat));
      const heading = this.heading();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.translate(at.x, at.y);
      if (heading != null) ctx.rotate(((heading - cam.bearing) * Math.PI) / 180);
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

  /** Gesetzte Kamera, sonst die ganze Route, sonst der Standort. */
  private effectiveCamera(view: Viewport): MapCamera | null {
    const cam = this.camera();
    if (cam) return cam;
    const bounds = this.bounds();
    if (bounds) return fitCamera(bounds, view);
    const pos = this.position();
    return pos
      ? { x: mercX(pos.lon), y: mercY(pos.lat), zoom: 16, bearing: 0, anchorY: 0.5 }
      : null;
  }

  private local(event: PointerEvent | WheelEvent): ScreenPoint {
    const rect = this.host.nativeElement.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  /** Neuer Ausgangspunkt, sobald ein Finger dazukommt oder geht: sonst springt die Karte. */
  private rebase(rotating = false): void {
    const cam = this.lastCamera;
    this.gesture =
      cam && this.pointers.size ? { cam, pts: [...this.pointers.values()], rotating } : null;
  }

  private emit(cam: MapCamera): void {
    this.lastCamera = cam;
    this.camera.set(cam);
  }

  protected onPointerDown(event: PointerEvent): void {
    if (!this.interactive() || (event.pointerType === 'mouse' && event.button !== 0)) return;
    this.host.nativeElement.setPointerCapture?.(event.pointerId);
    const p = this.local(event);
    this.pointers.set(event.pointerId, p);
    if (this.pointers.size === 1) {
      this.downAt = p;
      this.moved = false;
    } else {
      this.moved = true;
    }
    this.rebase();
  }

  protected onPointerMove(event: PointerEvent): void {
    if (!this.pointers.has(event.pointerId)) return;
    const p = this.local(event);
    this.pointers.set(event.pointerId, p);
    if (!this.moved) {
      const start = this.downAt ?? p;
      if (Math.hypot(p.x - start.x, p.y - start.y) < TAP_SLOP) return;
      this.moved = true;
      // Von der aktuellen Kamera aus: Sie kann seit dem Aufsetzen nachgeführt worden sein.
      if (this.gesture && this.lastCamera) this.gesture.cam = this.lastCamera;
    }
    const g = this.gesture;
    if (!g) return;
    const { w, h } = this.size();
    const view = { w, h };
    const pts = [...this.pointers.values()];
    if (pts.length < 2 || g.pts.length < 2) {
      this.emit(panCamera(g.cam, view, g.pts[0], pts[0]));
      return;
    }
    const from: [ScreenPoint, ScreenPoint] = [g.pts[0], g.pts[1]];
    const to: [ScreenPoint, ScreenPoint] = [pts[0], pts[1]];
    this.emit(pinchCamera(g.cam, view, from, to, g.rotating));
    // Ab der Schwelle dreht die Karte mit, von hier an ohne Sprung.
    if (!g.rotating && Math.abs(twist(from, to)) > (ROTATE_START_DEG * Math.PI) / 180) {
      this.rebase(true);
    }
  }

  protected onPointerUp(event: PointerEvent): void {
    if (!this.pointers.delete(event.pointerId)) return;
    this.rebase(this.gesture?.rotating ?? false);
  }

  protected onWheel(event: WheelEvent): void {
    const cam = this.lastCamera;
    if (!this.interactive() || !cam) return;
    event.preventDefault();
    const { w, h } = this.size();
    // Eine Raste des Mausrads (100) ist eine halbe Zoomstufe.
    this.emit(zoomAt(cam, { w, h }, this.local(event), -event.deltaY / 200));
  }

  /** Ein Verschieben endet nicht als Tipp: die Fahrtseite blendete sonst die Leiste ein. */
  protected onClick(event: MouseEvent): void {
    if (!this.moved) return;
    this.moved = false;
    event.stopPropagation();
  }
}
