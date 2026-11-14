const R = 6371008.8;
const RAD = Math.PI / 180;

export interface XY {
  x: number;
  y: number;
}

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = (lat2 - lat1) * RAD;
  const dLon = (lon2 - lon1) * RAD;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Kurs von Punkt 1 nach Punkt 2 in Grad, 0 = Norden, im Uhrzeigersinn. */
export function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const y = Math.sin((lon2 - lon1) * RAD) * Math.cos(lat2 * RAD);
  const x =
    Math.cos(lat1 * RAD) * Math.sin(lat2 * RAD) -
    Math.sin(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.cos((lon2 - lon1) * RAD);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

/** Richtungsänderung von `from` nach `to` in (-180, 180]; positiv = nach rechts. */
export function angleDiff(from: number, to: number): number {
  const d = ((to - from + 540) % 360) - 180;
  return d === -180 ? 180 : d;
}

/** Ebene Näherung in Metern rund um einen Bezugspunkt. Für wenige Kilometer genau genug. */
export function toLocal(lat: number, lon: number, lat0: number, lon0: number): XY {
  return { x: (lon - lon0) * RAD * R * Math.cos(lat0 * RAD), y: (lat - lat0) * RAD * R };
}

/** Lotfußpunkt von `p` auf die Strecke a–b: Anteil t in [0, 1] und Abstand in Metern. */
export function projectOnSegment(p: XY, a: XY, b: XY): { t: number; dist: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return { t, dist: Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)) };
}

/** Web-Mercator, normiert auf 0..1 (mit 256 · 2^zoom multiplizieren für Pixel). */
export function mercX(lon: number): number {
  return (lon + 180) / 360;
}
export function mercY(lat: number): number {
  const s = Math.sin(lat * RAD);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
}
