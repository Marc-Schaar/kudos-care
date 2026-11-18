import { bearing } from '../core/geo';
import { WindKind, relativeWind } from '../core/wind';
import { RoutePoint } from './nav-models';

/** Kurs über so viele Meter davor und dahinter: Knicke im Routenverlauf färben nichts um. */
const HEADING_WINDOW_M = 40;
/** Kürzere Abschnitte gehen im Nachbarn auf, sonst flackert die Linie in jeder Kurve. */
const MIN_RUN_M = 120;

/** Zusammenhängender Teil der Route mit derselben Windwirkung, von Punkt `from` bis `to`. */
export interface WindRun {
  from: number;
  to: number;
  kind: WindKind;
}

const runLength = (run: WindRun, points: RoutePoint[]): number =>
  points[run.to].dist - points[run.from].dist;

/** Fügt direkt aufeinanderfolgende Abschnitte gleicher Wirkung zusammen. */
function joinRuns(runs: WindRun[]): WindRun[] {
  const out: WindRun[] = [];
  for (const run of runs) {
    const prev = out[out.length - 1];
    if (prev?.kind === run.kind) prev.to = run.to;
    else out.push({ ...run });
  }
  return out;
}

/**
 * Teilt die Route danach auf, wie der Wind auf ihr wirkt. Die Einteilung kommt aus
 * `relativeWind`, damit Linie, Windpfeil und Windbalken dasselbe sagen. Es gibt nur den
 * aktuellen Wind am Standort, er gilt hier also für die ganze Strecke.
 */
export function routeWindRuns(points: RoutePoint[], fromDeg: number, speedKmh: number): WindRun[] {
  if (points.length < 2) return [];
  let runs: WindRun[] = [];
  let behind = 0;
  let ahead = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const mid = (points[i].dist + points[i + 1].dist) / 2;
    while (points[behind + 1].dist <= mid - HEADING_WINDOW_M) behind++;
    while (ahead < points.length - 1 && points[ahead].dist < mid + HEADING_WINDOW_M) ahead++;
    const a = points[behind];
    const b = points[ahead];
    const course = bearing(a.lat, a.lon, b.lat, b.lon);
    runs.push({ from: i, to: i + 1, kind: relativeWind(fromDeg, speedKmh, course).kind });
  }
  runs = joinRuns(runs);

  // Immer den kürzesten zuerst: er geht im längeren Nachbarn auf.
  while (runs.length > 1) {
    let shortest = -1;
    let min = MIN_RUN_M;
    runs.forEach((run, i) => {
      const length = runLength(run, points);
      if (length < min) {
        min = length;
        shortest = i;
      }
    });
    if (shortest < 0) break;
    const left = runs[shortest - 1];
    const right = runs[shortest + 1];
    const into =
      !right || (left && runLength(left, points) >= runLength(right, points)) ? left : right;
    runs[shortest] = { ...runs[shortest], kind: into.kind };
    runs = joinRuns(runs);
  }
  return runs;
}
