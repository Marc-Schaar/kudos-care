import { mercX, mercY } from '../core/geo';

/** Kantenlänge einer Kartenkachel in CSS-Pixeln. */
export const TILE = 256;
/** Weit genug für die Übersicht einer langen Tour, nah genug für eine Einfahrt. */
export const MIN_ZOOM = 5;
export const MAX_ZOOM = 19;

/**
 * Was die Karte zeigt. Die Mitte steht in Web-Mercator (0..1), damit Verschieben und
 * Zoomen ohne Umweg über Grad rechnen; die Zoomstufe darf Bruchteile haben (Pinch).
 */
export interface MapCamera {
  x: number;
  y: number;
  zoom: number;
  /** Kurs, der oben liegt, in Grad: 0 = Norden oben, 90 = Osten oben. */
  bearing: number;
  /** Höhe der Mitte auf dem Bildschirm: 0,5 = mittig, 0,66 = unteres Drittel. */
  anchorY: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface Viewport {
  w: number;
  h: number;
}

/** Ausdehnung einer Strecke in Web-Mercator. */
export interface MercBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const RAD = Math.PI / 180;

export const clampZoom = (z: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
const normBearing = (deg: number): number => ((deg % 360) + 360) % 360;

/** Kamera, die auf einen Ort schaut. */
export function cameraAt(
  lat: number,
  lon: number,
  zoom: number,
  bearing = 0,
  anchorY = 0.5,
): MapCamera {
  return { x: mercX(lon), y: mercY(lat), zoom, bearing: normBearing(bearing), anchorY };
}

/**
 * Bildschirmpunkt → Web-Mercator. Die Karte ist um −bearing gedreht gezeichnet, also wird
 * der Abstand zur Mitte um +bearing zurückgedreht.
 */
export function screenToWorld(cam: MapCamera, view: Viewport, p: ScreenPoint): ScreenPoint {
  const scale = TILE * 2 ** cam.zoom;
  const dx = p.x - view.w / 2;
  const dy = p.y - view.h * cam.anchorY;
  const b = cam.bearing * RAD;
  return {
    x: cam.x + (dx * Math.cos(b) - dy * Math.sin(b)) / scale,
    y: cam.y + (dx * Math.sin(b) + dy * Math.cos(b)) / scale,
  };
}

/** Web-Mercator → Bildschirmpunkt. */
export function worldToScreen(cam: MapCamera, view: Viewport, wx: number, wy: number): ScreenPoint {
  const scale = TILE * 2 ** cam.zoom;
  const dx = (wx - cam.x) * scale;
  const dy = (wy - cam.y) * scale;
  const b = cam.bearing * RAD;
  return {
    x: view.w / 2 + dx * Math.cos(b) + dy * Math.sin(b),
    y: view.h * cam.anchorY - dx * Math.sin(b) + dy * Math.cos(b),
  };
}

/** Verschiebt die Mitte so, dass der Weltpunkt `world` unter dem Bildschirmpunkt `p` liegt. */
function placeUnder(cam: MapCamera, view: Viewport, world: ScreenPoint, p: ScreenPoint): MapCamera {
  const at = screenToWorld({ ...cam, x: 0, y: 0 }, view, p);
  return { ...cam, x: world.x - at.x, y: world.y - at.y };
}

/** Ein Finger: Was unter dem Finger lag, bleibt unter dem Finger. */
export function panCamera(
  start: MapCamera,
  view: Viewport,
  from: ScreenPoint,
  to: ScreenPoint,
): MapCamera {
  return placeUnder(start, view, screenToWorld(start, view, from), to);
}

/**
 * Zwei Finger: Abstand → Zoom, Mittelpunkt → Verschieben, Verdrehen → Drehen (nur mit
 * `rotate`, damit ein reines Zoomen die Karte nicht schief stellt).
 */
export function pinchCamera(
  start: MapCamera,
  view: Viewport,
  from: readonly [ScreenPoint, ScreenPoint],
  to: readonly [ScreenPoint, ScreenPoint],
  rotate: boolean,
): MapCamera {
  const d0 = Math.hypot(from[1].x - from[0].x, from[1].y - from[0].y);
  const d1 = Math.hypot(to[1].x - to[0].x, to[1].y - to[0].y);
  const zoom = d0 > 0 && d1 > 0 ? clampZoom(start.zoom + Math.log2(d1 / d0)) : start.zoom;
  // Dreht man die Finger im Uhrzeigersinn, dreht die Karte mit: der Kurs oben wird kleiner.
  const bearing = rotate ? normBearing(start.bearing - twist(from, to) / RAD) : start.bearing;
  const mid = (pts: readonly [ScreenPoint, ScreenPoint]): ScreenPoint => ({
    x: (pts[0].x + pts[1].x) / 2,
    y: (pts[0].y + pts[1].y) / 2,
  });
  const world = screenToWorld(start, view, mid(from));
  return placeUnder({ ...start, zoom, bearing }, view, world, mid(to));
}

/** Verdrehung zweier Finger zwischen zwei Zeitpunkten, im Bogenmaß in (−π, π]. */
export function twist(
  from: readonly [ScreenPoint, ScreenPoint],
  to: readonly [ScreenPoint, ScreenPoint],
): number {
  const a0 = Math.atan2(from[1].y - from[0].y, from[1].x - from[0].x);
  const a1 = Math.atan2(to[1].y - to[0].y, to[1].x - to[0].x);
  let d = a1 - a0;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d <= -Math.PI) d += 2 * Math.PI;
  return d;
}

/** Zoomt um `dz` Stufen um einen Bildschirmpunkt (Mausrad). */
export function zoomAt(cam: MapCamera, view: Viewport, p: ScreenPoint, dz: number): MapCamera {
  const world = screenToWorld(cam, view, p);
  return placeUnder({ ...cam, zoom: clampZoom(cam.zoom + dz) }, view, world, p);
}

/**
 * Die ganze Strecke im Bild, Norden oben, mit Rand. Kurze Strecken nicht näher als
 * Stufe 17, sonst füllt ein Kilometer den Bildschirm und man sieht keine Straßen mehr.
 */
export function fitCamera(bounds: MercBounds, view: Viewport, padding = 32): MapCamera {
  const w = Math.max(1, view.w - 2 * padding);
  const h = Math.max(1, view.h - 2 * padding);
  const dx = (bounds.maxX - bounds.minX) * TILE;
  const dy = (bounds.maxY - bounds.minY) * TILE;
  const fit = Math.log2(Math.min(dx > 0 ? w / dx : Infinity, dy > 0 ? h / dy : Infinity));
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
    zoom: Number.isFinite(fit) ? Math.min(17, clampZoom(fit)) : 17,
    bearing: 0,
    anchorY: 0.5,
  };
}

/**
 * Zoom nach Tempo, abgestimmt aufs Rad: bis 12 km/h nah dran (Stadt, Kreuzungen
 * erkennen), darüber weiter weg, sodass vor dem Pfeil stets rund eine Minute Fahrt zu
 * sehen ist (bei 20 km/h gut 300 m, bei 45 km/h rund 900 m). Werte dazwischen linear.
 */
export const SPEED_ZOOM: readonly (readonly [kmh: number, zoom: number])[] = [
  [0, 17],
  [12, 17],
  [20, 16.5],
  [30, 15.75],
  [45, 15],
];

export function zoomForSpeed(kmh: number): number {
  const table = SPEED_ZOOM;
  if (!(kmh > table[0][0])) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [v1, z1] = table[i];
    if (kmh <= v1) {
      const [v0, z0] = table[i - 1];
      return z0 + ((kmh - v0) / (v1 - v0)) * (z1 - z0);
    }
  }
  return table[table.length - 1][1];
}

/** Zeitkonstante der Tempoglättung (s): ein Antritt oder eine Ampel zoomt nicht sofort. */
const SPEED_SMOOTH_S = 8;
/** Zoom in Viertelstufen: die Karte pumpt nicht bei jeder Temposchwankung. */
const ZOOM_STEP = 0.25;
/**
 * Umgerastet wird ab drei Vierteln einer Stufe Abstand. Mehr als eine halbe Stufe, sonst
 * pendelt der Zoom an der Rundungsgrenze; weniger als eine ganze, sonst erreicht das
 * geglättete Tempo, das sich dem Ziel nur annähert, die letzte Stufe nie.
 */
const SWITCH_AT = ZOOM_STEP * 0.75;

/** Tempo-Zoom mit Gedächtnis: geglättetes Tempo, gerasteter Zoom. */
export class SpeedZoom {
  private speed: number | null = null;
  private at = 0;
  private current = zoomForSpeed(0);

  /** Tempo in m/s (oder `null` ohne frische Position), Zeit in ms. */
  update(speedMs: number | null, t: number): number {
    const v = Math.max(0, speedMs ?? 0);
    const first = this.speed == null;
    if (this.speed == null) this.speed = v;
    else {
      const dt = Math.max(0, (t - this.at) / 1000);
      this.speed += (v - this.speed) * (1 - Math.exp(-dt / SPEED_SMOOTH_S));
    }
    this.at = t;
    const target = zoomForSpeed(this.speed * 3.6);
    if (first || Math.abs(target - this.current) >= SWITCH_AT)
      this.current = Math.round(target / ZOOM_STEP) * ZOOM_STEP;
    return this.current;
  }
}
