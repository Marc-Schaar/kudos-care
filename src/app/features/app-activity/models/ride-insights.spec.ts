import { describe, expect, it } from 'vitest';
import { Activity } from '../../../shared/services/strava-service/strava-service';
import { buildTally, formatDuration, groupByMonth, rideWeather, routePath } from './ride-insights';

function ride(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 1,
    name: 'Runde',
    distance: 40_000,
    start_date: '2026-08-10T08:00:00Z',
    elapsed_time: 5400,
    bike: 1,
    track: null,
    weather_data: null,
    ...overrides,
  };
}

describe('rideWeather', () => {
  it('kennt ohne Wetterdaten keine Antwort, statt "trocken" zu behaupten', () => {
    expect(rideWeather(ride())).toBeNull();
  });

  it('wertet nur Fahrten mit nennenswertem Regen als nass', () => {
    const wet = rideWeather(ride({ weather_data: { precipitation: [3, 4], temperature_2m: [12, 14] } }));
    const dry = rideWeather(ride({ weather_data: { precipitation: [0.1, 0.2], temperature_2m: [12] } }));
    expect(wet?.wet).toBe(true);
    expect(wet?.avgTemperature).toBe(13);
    expect(dry?.wet).toBe(false);
  });

  it('übersteht Lücken in den Stundenwerten', () => {
    const weather = rideWeather(ride({ weather_data: { precipitation: [null, 1], temperature_2m: [] } }));
    expect(weather?.avgPrecipitation).toBe(1);
    expect(weather?.avgTemperature).toBeNull();
  });
});

describe('routePath', () => {
  const track = 'SRID=4326;LINESTRING (11.5 48.1, 11.6 48.1, 11.6 48.2, 11.5 48.1)';

  it('liest einen WKT-Track und bleibt im Feld', () => {
    const path = routePath(track, 48)!;
    expect(path.startsWith('M')).toBe(true);
    const numbers = path.match(/\d+\.\d/g)!.map(Number);
    expect(Math.max(...numbers)).toBeLessThanOrEqual(48);
    expect(Math.min(...numbers)).toBeGreaterThanOrEqual(0);
  });

  it('dünnt lange Tracks aus', () => {
    const coordinates = Array.from({ length: 500 }, (_, i) => `${11 + i / 1000} ${48 + i / 1000}`);
    const path = routePath(`LINESTRING (${coordinates.join(', ')})`, 48, 40)!;
    expect((path.match(/L/g) ?? []).length).toBeLessThanOrEqual(45);
  });

  it('gibt ohne brauchbaren Track null zurück', () => {
    expect(routePath(null)).toBeNull();
    expect(routePath('LINESTRING (11 48)')).toBeNull();
    expect(routePath('LINESTRING (11 48, 11 48)')).toBeNull();
    expect(routePath('kaputt')).toBeNull();
  });
});

describe('groupByMonth', () => {
  it('sortiert neueste zuerst und summiert je Monat', () => {
    const groups = groupByMonth([
      ride({ id: 1, start_date: '2026-07-15T08:00:00Z', distance: 10_000 }),
      ride({ id: 2, start_date: '2026-08-02T08:00:00Z', distance: 20_000 }),
      ride({ id: 3, start_date: '2026-08-20T08:00:00Z', distance: 30_000 }),
    ]);
    expect(groups.map((group) => group.label)).toEqual(['August 2026', 'Juli 2026']);
    expect(groups[0].km).toBe(50);
    expect(groups[0].rides.map((r) => r.id)).toEqual([3, 2]);
  });
});

describe('buildTally', () => {
  const now = new Date('2026-09-01T12:00:00Z');

  it('zählt nur Fahrten im Fenster', () => {
    const tally = buildTally(
      [
        ride({ id: 1, start_date: '2026-08-10T08:00:00Z' }),
        ride({ id: 2, start_date: '2025-01-10T08:00:00Z' }),
      ],
      now,
    );
    expect(tally.marks.map((mark) => mark.id)).toEqual([1]);
  });

  it('zeigt nach einer langen Pause die letzten Fahrten statt einer leeren Fläche', () => {
    const tally = buildTally([ride({ id: 1, start_date: '2025-06-10T08:00:00Z' })], now);
    expect(tally.marks).toHaveLength(1);
    expect(tally.marks[0].x).toBeCloseTo(100);
  });

  it('hält die kürzeste Fahrt als Strich lesbar', () => {
    const tally = buildTally(
      [ride({ id: 1, distance: 100_000 }), ride({ id: 2, distance: 500 })],
      now,
    );
    expect(tally.marks.find((mark) => mark.id === 2)!.height).toBe(14);
    expect(tally.marks.find((mark) => mark.id === 1)!.height).toBe(100);
  });

  it('zählt nasse Fahrten und übersteht eine leere Liste', () => {
    const tally = buildTally(
      [ride({ id: 1, weather_data: { precipitation: [3], temperature_2m: [10] } }), ride({ id: 2 })],
      now,
    );
    expect(tally.wetCount).toBe(1);
    expect(buildTally([], now).marks).toEqual([]);
  });
});

describe('formatDuration', () => {
  it('schreibt Stunden und Minuten', () => {
    expect(formatDuration(5400)).toBe('1 h 30 min');
    expect(formatDuration(1800)).toBe('30 min');
    expect(formatDuration(null)).toBe('–');
  });
});
