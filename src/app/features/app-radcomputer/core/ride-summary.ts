import { haversine } from './geo';
import { TrackPoint } from './models';

/** Seitenverhältnis der Streckenzeichnung auf der Speichern-Seite (viewBox-Einheiten). */
export const SHAPE_W = 1000;
export const SHAPE_H = 625;
const PAD = 48;
/** Darunter ist die „Strecke“ GPS-Zappeln im Stand; vergrößert sähe sie aus wie ein Knäuel. */
const MIN_SPAN_M = 60;

export interface RouteShape {
  /** SVG-Pfad in viewBox-Einheiten (SHAPE_W × SHAPE_H) */
  d: string;
  start: readonly [number, number];
  end: readonly [number, number];
}

/**
 * Die gefahrene Strecke als Umriss, eingepasst in SHAPE_W × SHAPE_H, Norden oben.
 * Punkte ohne Koordinaten (kein GPS-Fix) fallen heraus. `null`, wenn es nichts zu zeichnen gibt.
 */
export function routeShape(track: readonly TrackPoint[], maxPoints = 400): RouteShape | null {
  const pts: [number, number][] = [];
  for (const p of track) if (p[1] != null && p[2] != null) pts.push([p[1], p[2]]);
  if (pts.length < 2) return null;

  let minLat = Infinity,
    maxLat = -Infinity,
    minLon = Infinity,
    maxLon = -Infinity;
  for (const [lat, lon] of pts) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  }
  const span = Math.max(
    haversine(minLat, minLon, maxLat, minLon),
    haversine(minLat, minLon, minLat, maxLon),
  );
  if (span < MIN_SPAN_M) return null;

  // Längengrade werden zum Pol hin schmaler; ohne den Faktor wäre die Strecke gestaucht.
  const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const w = (maxLon - minLon) * kx;
  const h = maxLat - minLat;
  const scale = Math.min((SHAPE_W - 2 * PAD) / (w || 1e-12), (SHAPE_H - 2 * PAD) / (h || 1e-12));
  const ox = (SHAPE_W - w * scale) / 2;
  const oy = (SHAPE_H - h * scale) / 2;
  const project = ([lat, lon]: [number, number]): [number, number] => [
    Math.round((ox + (lon - minLon) * kx * scale) * 10) / 10,
    Math.round((oy + (maxLat - lat) * scale) * 10) / 10,
  ];

  const step = Math.max(1, Math.ceil(pts.length / maxPoints));
  const xy: [number, number][] = [];
  for (let i = 0; i < pts.length; i += step) xy.push(project(pts[i]));
  if ((pts.length - 1) % step !== 0) xy.push(project(pts[pts.length - 1]));

  return {
    d: xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(''),
    start: xy[0],
    end: xy[xy.length - 1],
  };
}

/** Vorschlag für den Strava-Titel nach der Startzeit, wie ihn Strava selbst vergibt. */
export function defaultRideName(startedAt: number | null): string {
  if (startedAt == null) return 'Radfahrt';
  const h = new Date(startedAt).getHours();
  if (h >= 5 && h < 11) return 'Morgenfahrt';
  if (h >= 11 && h < 14) return 'Mittagsfahrt';
  if (h >= 14 && h < 18) return 'Nachmittagsfahrt';
  if (h >= 18 && h < 22) return 'Abendfahrt';
  return 'Nachtfahrt';
}
