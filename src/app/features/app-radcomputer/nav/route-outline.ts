import { mercX, mercY } from '../core/geo';

/** Google-Polyline (Strava `summary_polyline`) → [lat, lon]-Paare. */
export function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let i = 0;
  let lat = 0;
  let lon = 0;
  const next = (): number | null => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      if (i >= encoded.length) return null;
      byte = encoded.charCodeAt(i++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < encoded.length) {
    const dLat = next();
    const dLon = next();
    if (dLat == null || dLon == null) break; // abgeschnittene Zeichenkette: bis hier
    lat += dLat;
    lon += dLon;
    points.push([lat / 1e5, lon / 1e5]);
  }
  return points;
}

export interface RouteOutline {
  /** SVG-Pfad im Kasten `0 0 width height` */
  d: string;
  start: { x: number; y: number };
}

/**
 * Umriss einer Strecke für die Routenliste: Mercator, seitentreu in den Kasten eingepasst
 * und mittig gesetzt. Ohne mindestens zwei Punkte gibt es keinen Umriss.
 */
export function routeOutline(
  encoded: string,
  width: number,
  height: number,
  pad = 4,
): RouteOutline | null {
  const pts = decodePolyline(encoded).map(([lat, lon]) => [mercX(lon), mercY(lat)]);
  if (pts.length < 2) return null;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX;
  const spanY = Math.max(...ys) - minY;
  const span = Math.max(spanX, spanY);
  if (span === 0) return null;
  const scale = Math.min((width - 2 * pad) / (spanX || span), (height - 2 * pad) / (spanY || span));
  const offX = (width - spanX * scale) / 2;
  const offY = (height - spanY * scale) / 2;
  const xy = pts.map(([x, y]) => ({
    x: Math.round((offX + (x - minX) * scale) * 10) / 10,
    y: Math.round((offY + (y - minY) * scale) * 10) / 10,
  }));
  return {
    d: xy.map((p, n) => `${n ? 'L' : 'M'}${p.x} ${p.y}`).join(''),
    start: xy[0],
  };
}
