import { describe, expect, it } from 'vitest';

import { compassHeading } from '../core/heading';
import { TrackPoint } from '../core/models';
import { TrackAccumulator, liveClimb } from '../core/ride-metrics';
import { emptyDraft } from '../core/ride-sync';
import { sunTimes } from '../core/sun';
import { tagsFor } from '../menu/save-page';
import {
  DEFAULT_PAGES,
  FIELDS,
  effectivePages,
  fieldDef,
  pageLayout,
  powerReading,
  powerZone,
} from './fields';

/** Trackpunkt je Sekunde: [t, lat, lon, alt, dist, hr, cad, pwr] */
function point(
  s: number,
  o: {
    alt?: number | null;
    dist?: number;
    hr?: number | null;
    cad?: number | null;
    pwr?: number | null;
  } = {},
): TrackPoint {
  return [s * 1000, 51, 7, o.alt ?? null, o.dist ?? 0, o.hr ?? null, o.cad ?? null, o.pwr ?? null];
}

describe('Datenseiten', () => {
  it('teilt sechs Felder wie die bisherige feste Seite auf', () => {
    expect(pageLayout(6)).toEqual({
      sizes: ['hero', 'normal', 'normal', 'normal', 'normal', 'wide'],
      rows: '1.45fr 1fr 1fr 0.85fr',
    });
  });

  it('stellt ein übrig bleibendes Feld über die volle Breite', () => {
    expect(pageLayout(4).sizes).toEqual(['hero', 'normal', 'normal', 'wide']);
    expect(pageLayout(5).sizes).toEqual(['hero', 'normal', 'normal', 'normal', 'normal']);
    expect(pageLayout(1)).toEqual({ sizes: ['hero'], rows: '1fr' });
  });

  it('fällt ohne eigene Seiten auf die Standardseiten zurück', () => {
    expect(effectivePages([])).toEqual(DEFAULT_PAGES);
    expect(effectivePages(null)).toEqual(DEFAULT_PAGES);
  });

  it('überspringt unbekannte Felder und leere Seiten, statt zu brechen', () => {
    const pages = effectivePages([
      { name: 'Neu', fields: ['speed', 'kommtErstSpaeter'] },
      { name: 'Leer', fields: ['kommtErstSpaeter'] },
    ]);
    expect(pages).toEqual([{ name: 'Neu', fields: ['speed'] }]);
  });

  it('kennt jedes Feld der Standardseiten', () => {
    for (const page of DEFAULT_PAGES)
      for (const key of page.fields) expect(fieldDef(key)).not.toBeNull();
  });

  it('vergibt keinen Schlüssel doppelt, und alle passen zum Format des Backends', () => {
    const keys = FIELDS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    // app_radcomputer/serializers.py::FIELD_KEY
    for (const key of keys) expect(key).toMatch(/^[a-zA-Z][a-zA-Z0-9]{0,23}$/);
  });

  it('ordnet Leistung den Coggan-Zonen zu', () => {
    expect(powerZone(0.5)).toBe(1);
    expect(powerZone(0.8)).toBe(3);
    expect(powerZone(1.0)).toBe(4);
    expect(powerZone(1.1)).toBe(5);
    expect(powerZone(2)).toBe(7);
  });

  it('gibt Leistungsfeldern die Zone für die Leitlinie mit', () => {
    expect(powerReading(245, 260)).toEqual({ value: '245', zone: 4 });
    expect(powerReading(400, 260)).toEqual({ value: '400', zone: 7 });
  });

  it('zeigt ohne Messwert keine Zone, statt Z7 zu behaupten', () => {
    expect(powerReading(null, 260)).toEqual({ value: '--' });
    expect(powerReading(Number.NaN, 260)).toEqual({ value: '--' });
  });
});

describe('Kennzahlen aus dem Track', () => {
  it('rechnet Normalized Power erst nach 30 Sekunden, bei konstanter Leistung gleich dem Mittel', () => {
    const acc = new TrackAccumulator();
    const track = Array.from({ length: 29 }, (_, i) => point(i, { pwr: 200 }));
    expect(acc.update(track).np).toBeNull();
    track.push(point(29, { pwr: 200 }), point(30, { pwr: 200 }));
    expect(acc.update(track).np).toBeCloseTo(200, 5);
  });

  it('gewichtet Spitzen: Intervalle ergeben mehr NP als dieselbe Arbeit gleichmäßig', () => {
    const steady = new TrackAccumulator().update(
      Array.from({ length: 600 }, (_, i) => point(i, { pwr: 200 })),
    );
    const intervals = new TrackAccumulator().update(
      Array.from({ length: 600 }, (_, i) => point(i, { pwr: Math.floor(i / 60) % 2 ? 0 : 400 })),
    );
    expect(intervals.workJ).toBe(steady.workJ);
    expect(intervals.np!).toBeGreaterThan(steady.np! + 50);
  });

  it('zählt Arbeit, Puls und Kadenz ohne Rollphasen', () => {
    const totals = new TrackAccumulator().update([
      point(0, { pwr: 100, hr: 120, cad: 80 }),
      point(1, { pwr: 300, hr: 160, cad: 0 }),
    ]);
    expect(totals.workJ).toBe(400);
    expect(totals.avgHr).toBe(140);
    expect(totals.maxHr).toBe(160);
    expect(totals.avgCadence).toBe(80);
  });

  it('misst die Höchstgeschwindigkeit über mehrere Punkte, nicht über eine Pause hinweg', () => {
    const track = Array.from({ length: 10 }, (_, i) => point(i, { dist: i * 10 }));
    // Nach einer Pause von zehn Minuten geht es weiter: der Abstand zählt nicht als Tempo.
    track.push(point(610, { dist: 200 }));
    expect(new TrackAccumulator().update(track).maxSpeed).toBeCloseTo(10, 5);
  });

  it('zählt Abstieg mit derselben Hysterese wie den Anstieg', () => {
    const alts = [100, 99, 98, 97, 101, 95];
    const totals = new TrackAccumulator().update(alts.map((alt, i) => point(i, { alt })));
    // 100 → 98 zählt 2 m, das Zappeln bis 97 nicht; nach dem Anstieg auf 101 dann 6 m.
    expect(totals.descentM).toBeCloseTo(2 + 6, 5);
  });

  it('beginnt bei einer neuen Fahrt von vorn', () => {
    const acc = new TrackAccumulator();
    acc.update(Array.from({ length: 50 }, (_, i) => point(i, { pwr: 300 })));
    expect(acc.update([point(0, { pwr: 100 })]).workJ).toBe(100);
  });

  it('liest Steigung und Steigrate aus den letzten Punkten', () => {
    // 6 % über 200 m, mit 5 m/s: 18 m in 40 s.
    const track = Array.from({ length: 41 }, (_, i) =>
      point(i, { dist: i * 5, alt: 100 + i * 0.3 }),
    );
    const { grade } = liveClimb(track);
    expect(grade).toBeCloseTo(6, 1);
    const long = Array.from({ length: 91 }, (_, i) =>
      point(i, { dist: i * 5, alt: 100 + i * 0.3 }),
    );
    expect(liveClimb(long).vam).toBeCloseTo(0.3 * 3600, 0);
  });
});

describe('Sonnenuntergang', () => {
  const minutes = (d: Date): number => d.getUTCHours() * 60 + d.getUTCMinutes();

  it('trifft Frankfurt im November auf wenige Minuten', () => {
    // Laut Tafeln: Aufgang ~07:38, Untergang ~16:41 MEZ, also 06:38 und 15:41 UTC.
    const t = sunTimes(new Date('2026-11-17T12:00:00Z'), 50.11, 8.68)!;
    expect(Math.abs(minutes(t.sunrise) - (6 * 60 + 38))).toBeLessThan(8);
    expect(Math.abs(minutes(t.sunset) - (15 * 60 + 41))).toBeLessThan(8);
  });

  it('kennt im Polarsommer keinen Untergang', () => {
    expect(sunTimes(new Date('2026-06-21T12:00:00Z'), 78.2, 15.6)).toBeNull();
  });
});

describe('Kompass', () => {
  it('nimmt auf dem iPhone den Kompasskurs, sonst die absolute Ausrichtung', () => {
    expect(compassHeading({ webkitCompassHeading: 90, alpha: 10 }, false, 0)).toBe(90);
    expect(compassHeading({ alpha: 90, absolute: true }, false, 0)).toBe(270);
    expect(compassHeading({ alpha: 90 }, true, 0)).toBe(270);
  });

  it('verwirft relative Ausrichtung ohne Nordbezug', () => {
    expect(compassHeading({ alpha: 90, absolute: false }, false, 0)).toBeNull();
  });

  it('dreht im Querformat um den Bildschirmwinkel', () => {
    expect(compassHeading({ webkitCompassHeading: 300, alpha: null }, false, 90)).toBe(30);
  });
});

describe('Tags beim Speichern', () => {
  it('schickt nur, was vom Standard abweicht', () => {
    expect(tagsFor(emptyDraft())).toEqual({});
    expect(
      tagsFor({ ...emptyDraft('b12'), sportType: 'GravelRide', hideFromHome: true, commute: true }),
    ).toEqual({ sport_type: 'GravelRide', gear_id: 'b12', hide_from_home: true });
  });
});
