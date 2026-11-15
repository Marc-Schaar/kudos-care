import { describe, expect, it } from 'vitest';
import {
  NextRideForecast,
  NextRideItem,
  WarnStatus,
} from '../../../app-maintenance/models/maintenance.models';
import { DueItem } from '../../../app-maintenance/shared/utils/utils';
import { buildForecast, RULER_DAYS } from './forecast';

function due(key: string, title: string, ratio = 0.5): DueItem {
  return { key, title, ratio, status: 'ok', where: 'Antrieb', remaining: 'noch 20 km' } as DueItem;
}

function entry(
  kind: 'part' | 'interval',
  id: number,
  today: WarnStatus,
  then: WarnStatus,
): NextRideItem {
  return { kind, id, status_today: today, status_then: then };
}

function forecast(overrides: Partial<NextRideForecast> = {}): NextRideForecast {
  return {
    min_rides: 4,
    ride_count: 10,
    predicted_date: '2026-11-18',
    days_until: 3,
    is_overdue: false,
    predicted_km: 42,
    median_gap_days: 3,
    rides_considered: 10,
    items: [],
    ...overrides,
  };
}

describe('buildForecast', () => {
  it('sagt, wie viele Fahrten noch fehlen, solange es keine Prognose gibt', () => {
    const view = buildForecast(forecast({ predicted_date: null, ride_count: 2 }), []);
    expect(view.kind).toBe('pending');
    expect(view.sentence).toContain('Noch 2 Fahrten');
  });

  it('nennt Abstand und Strecke in einem Satz', () => {
    const view = buildForecast(forecast(), []);
    expect(view.sentence).toBe('In 3 Tagen fährst du wahrscheinlich wieder, rund 42 km.');
  });

  it('sagt morgen statt in 1 Tagen und lässt die Strecke weg, wenn sie unbekannt ist', () => {
    const view = buildForecast(forecast({ days_until: 1, predicted_km: null }), []);
    expect(view.sentence).toBe('Morgen fährst du wahrscheinlich wieder.');
  });

  it('behauptet bei einer Pause nicht jeden Tag "heute"', () => {
    const view = buildForecast(forecast({ days_until: 0, is_overdue: true }), []);
    expect(view.sentence).toBe('Nach deinem Rhythmus wärst du schon wieder dran, rund 42 km.');
    expect(view.kind === 'ready' && view.ruler).toBeNull();
  });

  it('listet nur, was die Fahrt neu über eine Grenze schiebt, Überfälliges zuerst', () => {
    const view = buildForecast(
      forecast({
        items: [
          entry('interval', 7, 'ok', 'warn'),
          entry('part', 1, 'warn', 'critical'),
          entry('part', 2, 'critical', 'critical'),
        ],
      }),
      [due('part-1', 'Kette'), due('part-2', 'Bremsbeläge'), due('interval-7', 'Kette ölen')],
    );
    if (view.kind !== 'ready') throw new Error('erwartet: Prognose');
    expect(view.checks.map((check) => [check.item.title, check.change])).toEqual([
      ['Kette', 'dann überfällig'],
      ['Kette ölen', 'dann bald fällig'],
    ]);
    expect(view.alreadyDue).toBe(1);
    expect(view.tone).toBe('critical');
  });

  it('zeichnet die Linie zeitmaßstäblich und bricht sie über dem Maßstab', () => {
    const near = buildForecast(forecast({ days_until: 2 }), []);
    const far = buildForecast(forecast({ days_until: 30 }), []);
    if (near.kind !== 'ready' || far.kind !== 'ready') throw new Error('erwartet: Prognose');
    expect(near.ruler?.span).toBeCloseTo(2 / RULER_DAYS);
    expect(near.ruler?.ticks).toEqual([0.5]);
    expect(far.ruler?.span).toBe(1);
    expect(far.ruler?.broken).toBe(true);
  });
});
