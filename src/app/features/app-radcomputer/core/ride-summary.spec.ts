import { TrackPoint } from './models';
import { SHAPE_H, SHAPE_W, defaultRideName, routeShape } from './ride-summary';

const pt = (lat: number | null, lon: number | null): TrackPoint => [
  0,
  lat,
  lon,
  null,
  0,
  null,
  null,
  null,
];

describe('routeShape', () => {
  it('liefert nichts ohne GPS-Punkte', () => {
    expect(routeShape([pt(null, null), pt(null, null)])).toBeNull();
  });

  it('liefert nichts, wenn man nur im Stand gezappelt hat', () => {
    expect(routeShape([pt(52.5, 13.4), pt(52.50001, 13.40001)])).toBeNull();
  });

  it('passt die Strecke in den Rahmen, Norden oben', () => {
    const shape = routeShape([pt(52.5, 13.4), pt(52.52, 13.4)])!;
    expect(shape).not.toBeNull();
    // Nach Norden gefahren: Ziel liegt über dem Start.
    expect(shape.end[1]).toBeLessThan(shape.start[1]);
    for (const [x, y] of [shape.start, shape.end]) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(SHAPE_W);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(SHAPE_H);
    }
  });

  it('dünnt lange Tracks aus und behält den letzten Punkt', () => {
    const track = Array.from({ length: 1001 }, (_, i) => pt(52.5 + i * 1e-4, 13.4));
    const shape = routeShape(track, 100)!;
    expect(shape.d.split('L').length).toBeLessThanOrEqual(102);
    expect(shape.end).toEqual(routeShape([track[0], track[1000]])!.end);
  });
});

describe('defaultRideName', () => {
  const at = (h: number) => new Date(2026, 10, 15, h, 30).getTime();

  it('benennt nach der Tageszeit', () => {
    expect(defaultRideName(at(7))).toBe('Morgenfahrt');
    expect(defaultRideName(at(12))).toBe('Mittagsfahrt');
    expect(defaultRideName(at(15))).toBe('Nachmittagsfahrt');
    expect(defaultRideName(at(19))).toBe('Abendfahrt');
    expect(defaultRideName(at(23))).toBe('Nachtfahrt');
  });

  it('fällt ohne Startzeit auf Radfahrt zurück', () => {
    expect(defaultRideName(null)).toBe('Radfahrt');
  });
});
