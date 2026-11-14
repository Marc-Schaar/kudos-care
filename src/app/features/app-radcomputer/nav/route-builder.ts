import { angleDiff, bearing, haversine, projectOnSegment, toLocal } from '../core/geo';
import { Place } from '../core/models';
import { CUE_TEXT, Cue, CueKind, NavRoute, RawCue, RoutePoint } from './nav-models';

/** So weit vor und hinter einem Punkt wird die Richtung gemessen (m). */
const LOOK_M = 20;
/** Ab dieser Richtungsänderung gilt ein Knick als Abbiegung (Grad). */
const TURN_DEG = 50;

/**
 * Macht aus einer Koordinatenliste eine Route mit Streckenlängen und Abbiegehinweisen.
 * Ohne mitgelieferte Hinweise (GPX, BRouter) werden sie aus der Geometrie geschätzt.
 */
export function buildRoute(
  name: string,
  coords: readonly (readonly [number, number])[],
  opts: { cues?: readonly RawCue[]; destination?: Place | null } = {},
): NavRoute {
  const points: RoutePoint[] = [];
  let dist = 0;
  for (const [lat, lon] of coords) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const prev = points[points.length - 1];
    if (prev) {
      const d = haversine(prev.lat, prev.lon, lat, lon);
      if (d < 0.5) continue; // doppelte Punkte
      dist += d;
    }
    points.push({ lat, lon, dist });
  }
  if (points.length < 2) throw new Error('Die Route enthält zu wenige Punkte.');

  const cues = opts.cues ? snapCues(points, opts.cues) : deriveCues(points);
  cues.push({ index: points.length - 1, dist, kind: 'arrive', text: CUE_TEXT.arrive });
  return { name, points, cues, lengthM: dist, destination: opts.destination ?? null };
}

/**
 * Schätzt Abbiegungen aus der Geometrie: Richtung 20 m vor gegen 20 m nach jedem Punkt.
 * Enge Kurven ohne Kreuzung werden dabei ebenfalls angesagt; das ist Absicht, denn
 * eine GPX-Datei verrät nicht, wo Kreuzungen sind.
 */
export function deriveCues(points: readonly RoutePoint[]): Cue[] {
  const cues: Cue[] = [];
  let lastDelta = 0;
  let before = 0;
  let after = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    while (before < i - 1 && p.dist - points[before + 1].dist >= LOOK_M) before++;
    if (after <= i) after = i + 1;
    while (after < points.length - 1 && points[after].dist - p.dist < LOOK_M) after++;
    const a = points[before];
    const b = points[after];
    if (p.dist - a.dist < 5 || b.dist - p.dist < 5) continue;

    const delta = angleDiff(
      bearing(a.lat, a.lon, p.lat, p.lon),
      bearing(p.lat, p.lon, b.lat, b.lon),
    );
    if (Math.abs(delta) < TURN_DEG) continue;
    const cue: Cue = {
      index: i,
      dist: p.dist,
      kind: turnKind(delta),
      text: CUE_TEXT[turnKind(delta)],
    };
    const last = cues[cues.length - 1];
    if (last && p.dist - last.dist < 30) {
      // Derselbe Knick, über mehrere Punkte verteilt: den schärfsten behalten.
      if (Math.abs(delta) > Math.abs(lastDelta)) {
        cues[cues.length - 1] = cue;
        lastDelta = delta;
      }
    } else {
      cues.push(cue);
      lastDelta = delta;
    }
  }
  return cues;
}

function turnKind(delta: number): CueKind {
  const abs = Math.abs(delta);
  if (abs >= 165) return 'uturn';
  const side = delta > 0 ? 'right' : 'left';
  return abs >= 115 ? `sharp-${side}` : side;
}

/** Ordnet Hinweise mit Koordinate dem nächstgelegenen Routenpunkt zu, in Fahrtrichtung. */
function snapCues(points: readonly RoutePoint[], raw: readonly RawCue[]): Cue[] {
  const cues: Cue[] = [];
  let from = 0;
  for (const cue of raw) {
    let best = from;
    let bestD = Infinity;
    for (let i = from; i < points.length; i++) {
      const d = haversine(points[i].lat, points[i].lon, cue.lat, cue.lon);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (bestD > 50) continue;
    from = best;
    cues.push({ index: best, dist: points[best].dist, kind: cue.kind, text: cue.text });
  }
  return cues;
}

export interface RouteMatch {
  index: number;
  alongM: number;
  offM: number;
}

/**
 * Sucht die Stelle der Route, die der Position am nächsten liegt. Zuerst rund um
 * den letzten Treffer (damit Schleifen und Hin-und-zurück-Strecken nicht springen),
 * erst bei größerem Abstand auf der ganzen Route.
 */
export function matchRoute(
  points: readonly RoutePoint[],
  lat: number,
  lon: number,
  hint: number,
): RouteMatch {
  const origin = { x: 0, y: 0 };
  const search = (from: number, to: number): RouteMatch => {
    let best: RouteMatch = { index: from, alongM: points[from].dist, offM: Infinity };
    for (let i = from; i < to; i++) {
      const a = toLocal(points[i].lat, points[i].lon, lat, lon);
      const b = toLocal(points[i + 1].lat, points[i + 1].lon, lat, lon);
      const hit = projectOnSegment(origin, a, b);
      if (hit.dist < best.offM) {
        best = {
          index: i,
          alongM: points[i].dist + hit.t * (points[i + 1].dist - points[i].dist),
          offM: hit.dist,
        };
      }
    }
    return best;
  };
  const last = points.length - 1;
  const start = Math.min(Math.max(0, hint - 5), last - 1);
  const near = search(start, Math.min(last, hint + 80));
  if (near.offM <= 60) return near;
  const anywhere = search(0, last);
  return anywhere.offM < near.offM - 20 ? anywhere : near;
}
