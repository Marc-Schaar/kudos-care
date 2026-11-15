import { WearImpactBreakdown, WearImpactCategory } from './wear-impact';
import { densestSpan, traceCategories, wearAtKm, wearTrace } from './wear-trace';
import { WindSegmentCollection } from './wind-segments';
import { idleSentence, pointSentence } from '../components/wear-trace/wear-trace';

function collection(kms: number[], rain: number[] = []): WindSegmentCollection {
  return {
    type: 'FeatureCollection',
    wind_source: 'stream',
    features: kms.map((km, index) => ({
      type: 'Feature',
      properties: {
        index,
        headwind: 0,
        wind_speed: 10,
        wind_direction: 180,
        bearing: 0,
        precipitation: rain[index] ?? 0,
        temperature: 12,
        distance_km: km,
      },
      geometry: { type: 'LineString', coordinates: [] },
    })),
  };
}

function category(extra: number[], driver: WearImpactCategory['dominant_driver'] = 'rain') {
  return {
    category: 'drivetrain',
    category_display: 'Antrieb',
    multiplier: 1.2,
    extra_pct: 20,
    extra_km: extra.reduce((a, b) => a + b, 0),
    dominant_driver: driver,
    dominant_driver_display: 'Regen',
    components: [],
    segment_extra_km: extra,
  } satisfies WearImpactCategory;
}

describe('wearTrace', () => {
  it('ends on ridden km plus the surcharge, the number of the breakdown', () => {
    const points = wearTrace(collection([10, 10, 10]), 30, [0, 4, 2]);
    expect(points.at(-1)!.wearKm).toBeCloseTo(36);
    expect(points.map((p) => p.factor)).toEqual([1, 1.4, 1.2]);
  });

  it('stretches the axis to the Strava distance like the wind profile', () => {
    const points = wearTrace(collection([5, 5]), 12, [0, 1]);
    expect(points.at(-1)!.endKm).toBeCloseTo(12);
    expect(points.at(-1)!.wearKm).toBeCloseTo(13);
  });

  it('interpolates inside a segment', () => {
    const points = wearTrace(collection([10, 10]), 20, [0, 5]);
    expect(wearAtKm(points, 5)).toBeCloseTo(5);
    expect(wearAtKm(points, 15)).toBeCloseTo(10 + 5 * 1.5);
    expect(wearAtKm(points, 99)).toBeCloseTo(25);
  });
});

describe('densestSpan', () => {
  it('finds the shortest stretch holding half of the surcharge', () => {
    const points = wearTrace(collection([10, 10, 10, 10]), 40, [0.5, 0, 4, 0.5]);
    expect(densestSpan(points)).toEqual({ startKm: 20, endKm: 30 });
  });

  it('is null without surcharge', () => {
    expect(densestSpan(wearTrace(collection([10]), 10, [0]))).toBeNull();
  });
});

describe('traceCategories', () => {
  const segments = collection([10, 10]);
  const breakdown = (cats: WearImpactCategory[]): WearImpactBreakdown => ({
    distance_km: 20,
    conditions: { precipitation: 1, temperature: 12, wind_speed: 10 },
    categories: cats,
    component_count: 1,
  });

  it('drops categories without surcharge', () => {
    expect(traceCategories(breakdown([category([0, 0])]), segments)).toEqual([]);
  });

  it('drops a distribution that does not match the segments', () => {
    expect(traceCategories(breakdown([category([1, 1, 1])]), segments)).toEqual([]);
  });

  it('keeps a matching one', () => {
    expect(traceCategories(breakdown([category([0, 2])]), segments)).toHaveLength(1);
  });
});

describe('sentences', () => {
  it('names the stretch where it happened', () => {
    const cat = category([0, 0, 6, 0]);
    const points = wearTrace(collection([10, 10, 10, 10]), 40, cat.segment_extra_km);
    expect(idleSentence(points, cat)).toBe(
      'Die Hälfte des Aufschlags für Antrieb entstand auf 10 von 40 km, zwischen km 20 und 30.',
    );
  });

  it('does not invent a hot spot when it is spread out', () => {
    const cat = category([1, 1, 1, 1]);
    const points = wearTrace(collection([10, 10, 10, 10]), 40, cat.segment_extra_km);
    expect(idleSentence(points, cat)).toBe(
      'Der Aufschlag für Antrieb verteilt sich über die ganze Strecke.',
    );
  });

  it('reads the factor and the driving condition at the cursor', () => {
    const cat = category([0, 5]);
    const points = wearTrace(collection([10, 10], [0, 3.4]), 20, cat.segment_extra_km);
    expect(pointSentence(points[1], cat)).toBe(
      'Bis km 20,0: 25,0 km verschlissen. Hier zählte jeder Kilometer 1,50-fach, bei 3,4 mm/h Regen.',
    );
    expect(pointSentence(points[0], cat)).toBe(
      'Bis km 10,0: 10,0 km verschlissen. Hier kam nichts dazu.',
    );
  });
});
