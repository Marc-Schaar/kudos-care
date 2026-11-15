import { describe, expect, it } from 'vitest';
import { WindSegmentCollection, WindSegmentProperties } from './wind-segments';
import {
  compass,
  idleSentence,
  profileSegments,
  rulerTicks,
  segmentAtKm,
  segmentSentence,
  verdictSentence,
  windVerdict,
} from './wind-profile';

function collection(values: Partial<WindSegmentProperties>[]): WindSegmentCollection {
  return {
    type: 'FeatureCollection',
    wind_source: 'stream',
    features: values.map((props, index) => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [] },
      properties: {
        index,
        headwind: null,
        wind_speed: null,
        wind_direction: null,
        bearing: null,
        precipitation: null,
        temperature: null,
        distance_km: 1,
        ...props,
      },
    })),
  };
}

describe('profileSegments', () => {
  it('legt die Abschnitte in Fahrtreihenfolge hintereinander, auch wenn sie anders ankommen', () => {
    const data = collection([{}, {}, {}]);
    data.features.reverse();
    const rows = profileSegments(data);
    expect(rows.map((row) => [row.index, row.startKm, row.endKm])).toEqual([
      [0, 0, 1],
      [1, 1, 2],
      [2, 2, 3],
    ]);
  });

  it('streckt die Achse auf die Strava-Distanz, damit die Seite nur eine Länge nennt', () => {
    const rows = profileSegments(collection([{}, {}, {}, {}]), 2);
    expect(rows.at(-1)?.endKm).toBeCloseTo(2);
    expect(rows[1].startKm).toBeCloseTo(0.5);
  });
});

describe('windVerdict', () => {
  it('zählt nur deutlichen Gegenwind, Seitenwind-Reste nicht', () => {
    const rows = profileSegments(collection([{ headwind: 8 }, { headwind: 1 }, { headwind: -6 }]));
    expect(windVerdict(rows)).toEqual({ headwindKm: 1, tailwindKm: 1, totalKm: 3 });
  });

  it('behauptet ohne Winddaten nichts', () => {
    expect(windVerdict(profileSegments(collection([{}, {}])))).toBeNull();
  });

  it('formuliert den Befund, auch für eine Fahrt ganz ohne Gegenwind', () => {
    expect(verdictSentence({ headwindKm: 18.4, tailwindKm: 0, totalKm: 42.3 })).toBe(
      '18 von 42 km gegen den Wind.',
    );
    expect(verdictSentence({ headwindKm: 0.2, tailwindKm: 9, totalKm: 20 })).toBe(
      'Kein Kilometer gegen den Wind.',
    );
  });
});

describe('Sätze zum Profil', () => {
  const rows = profileSegments(
    collection([
      { headwind: 3, wind_direction: 270, bearing: 90 },
      { headwind: 12.4, wind_direction: 225, bearing: 45, precipitation: 0.8 },
      { headwind: -0.5, wind_speed: 9, precipitation: 0 },
    ]),
  );

  it('nennt ohne Auswahl die stärkste Stelle', () => {
    expect(idleSentence(rows, 'wind')).toBe('Am stärksten gegen dich ab km 1: 12,4 km/h.');
    expect(idleSentence(rows, 'rain')).toBe('Am meisten Regen ab km 1: 0,8 mm/h.');
  });

  it('beschreibt einen Abschnitt mit Richtung von Wind und Fahrt', () => {
    expect(segmentSentence(rows[1], 'wind')).toBe(
      'km 1 bis 2: 12,4 km/h Gegenwind. Wind aus SW, du fuhrst nach NO.',
    );
  });

  it('nennt kaum spürbaren Gegenwind Seitenwind statt Rückenwind', () => {
    expect(segmentSentence(rows[2], 'wind')).toBe('km 2 bis 3: Wind von der Seite, 9 km/h.');
    expect(segmentSentence(rows[2], 'rain')).toBe('km 2 bis 3: trocken.');
  });

  it('sagt trocken, wenn es nirgends geregnet hat', () => {
    const dry = profileSegments(collection([{ precipitation: 0 }, { precipitation: 0 }]));
    expect(idleSentence(dry, 'rain')).toBe('Auf der ganzen Strecke trocken.');
  });
});

describe('Hilfsfunktionen', () => {
  it('wählt runde Lineal-Abstände', () => {
    expect(rulerTicks(16.8)).toEqual([0, 5, 10, 15]);
    expect(rulerTicks(4)).toEqual([0, 1, 2, 3, 4]);
    expect(rulerTicks(142)).toEqual([0, 25, 50, 75, 100, 125]);
  });

  it('findet den Abschnitt unter dem Zeiger und klemmt an den Rändern', () => {
    const rows = profileSegments(collection([{}, {}, {}]));
    expect(segmentAtKm(rows, 1.5)?.index).toBe(1);
    expect(segmentAtKm(rows, -1)?.index).toBe(0);
    expect(segmentAtKm(rows, 3)?.index).toBe(2);
  });

  it('rechnet auch negative und volle Kreise in Himmelsrichtungen um', () => {
    expect(compass(0)).toBe('N');
    expect(compass(359)).toBe('N');
    expect(compass(-90)).toBe('W');
    expect(compass(135)).toBe('SO');
  });
});
