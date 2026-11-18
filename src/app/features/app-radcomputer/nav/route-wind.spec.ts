import { RoutePoint } from './nav-models';
import { routeWindRuns } from './route-wind';

const M_PER_DEG_LAT = 111320;

/** Route aus Etappen [Ost, Nord] in Metern, alle 10 m ein Punkt, am Äquator. */
function route(legs: [number, number][]): RoutePoint[] {
  const points: RoutePoint[] = [{ lat: 0, lon: 0, dist: 0 }];
  let east = 0;
  let north = 0;
  let dist = 0;
  for (const [dE, dN] of legs) {
    const length = Math.hypot(dE, dN);
    const steps = Math.round(length / 10);
    for (let i = 1; i <= steps; i++) {
      points.push({
        lat: (north + (dN * i) / steps) / M_PER_DEG_LAT,
        lon: (east + (dE * i) / steps) / M_PER_DEG_LAT,
        dist: dist + (length * i) / steps,
      });
    }
    east += dE;
    north += dN;
    dist += length;
  }
  return points;
}

describe('Wind auf der Route', () => {
  it('färbt Hin- und Rückweg bei Nordwind gegensätzlich', () => {
    const points = route([
      [0, 1000],
      [0, -1000],
    ]);
    const runs = routeWindRuns(points, 0, 20);
    expect(runs.map((r) => r.kind)).toEqual(['head', 'tail']);
    expect(points[runs[0].to].dist).toBeCloseTo(1000, -2);
  });

  it('wertet Wind von der Seite als Seitenwind', () => {
    const runs = routeWindRuns(route([[0, 1000]]), 90, 20);
    expect(runs).toEqual([{ from: 0, to: 100, kind: 'cross' }]);
  });

  it('deckt die Route lückenlos ab', () => {
    const points = route([
      [0, 500],
      [500, 0],
      [0, -500],
    ]);
    const runs = routeWindRuns(points, 0, 20);
    expect(runs[0].from).toBe(0);
    expect(runs[runs.length - 1].to).toBe(points.length - 1);
    runs.slice(1).forEach((run, i) => expect(run.from).toBe(runs[i].to));
  });

  it('lässt einen kurzen Schlenker nicht umfärben', () => {
    const points = route([
      [0, 500],
      [0, -60],
      [0, 560],
    ]);
    expect(routeWindRuns(points, 0, 20).map((r) => r.kind)).toEqual(['head']);
  });

  it('liefert ohne Strecke keine Abschnitte', () => {
    expect(routeWindRuns([], 0, 20)).toEqual([]);
    expect(routeWindRuns([{ lat: 0, lon: 0, dist: 0 }], 0, 20)).toEqual([]);
  });
});
