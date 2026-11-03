import { describe, expect, it } from 'vitest';
import { DRY_KM, SAMPLE_RIDES, SEASON_KM, seasonAt } from './sample-season';
import { rideMultiplier, warnStatus } from './wear-formula';

const NEUTRAL = { precipitation: 0, temperature: 18, windSpeed: 10 };

describe('rideMultiplier', () => {
  it('zählt bei neutralem Wetter jeden Kilometer einmal', () => {
    expect(rideMultiplier(NEUTRAL, 'drivetrain')).toEqual({ multiplier: 1, driver: null });
  });

  it('rechnet Regen wie das Backend: 1 + 0,9 x 2,5 mm/h / 2,5', () => {
    const { multiplier, driver } = rideMultiplier({ ...NEUTRAL, precipitation: 2.5 }, 'drivetrain');
    expect(multiplier).toBeCloseTo(1.9);
    expect(driver).toBe('rain');
  });

  it('deckelt bei Faktor 2, egal wie stark es regnet', () => {
    expect(rideMultiplier({ ...NEUTRAL, precipitation: 50 }, 'drivetrain').multiplier).toBe(2);
  });

  it('gewichtet Kategorien unterschiedlich', () => {
    const rain = { ...NEUTRAL, precipitation: 2.5 };
    expect(rideMultiplier(rain, 'brakes').multiplier).toBeCloseTo(1.55);
    expect(rideMultiplier(rain, 'wheels').multiplier).toBeCloseTo(1.35);
    expect(rideMultiplier(rain, 'cockpit').multiplier).toBeCloseTo(1.25);
  });

  it('kennt Hitze, Kälte und Wind erst ab ihrer Schwelle', () => {
    expect(rideMultiplier({ ...NEUTRAL, temperature: 28 }, 'wheels').multiplier).toBe(1);
    expect(rideMultiplier({ ...NEUTRAL, temperature: 38 }, 'wheels').multiplier).toBeCloseTo(1.55);
    expect(rideMultiplier({ ...NEUTRAL, temperature: 5 }, 'wheels').multiplier).toBe(1);
    expect(rideMultiplier({ ...NEUTRAL, temperature: -10 }, 'wheels').multiplier).toBeCloseTo(1.45);
    expect(rideMultiplier({ ...NEUTRAL, windSpeed: 20 }, 'drivetrain').multiplier).toBe(1);
    expect(rideMultiplier({ ...NEUTRAL, windSpeed: 40 }, 'drivetrain').multiplier).toBeCloseTo(1.1);
  });
});

describe('warnStatus', () => {
  it('setzt die Ampel wie warn_status_from_ratio', () => {
    expect(warnStatus(0.79)).toBe('ok');
    expect(warnStatus(0.8)).toBe('warn');
    expect(warnStatus(1)).toBe('critical');
  });
});

describe('Beispielsaison', () => {
  it('läuft in der Trockenphase im Gleichschritt', () => {
    const point = seasonAt(DRY_KM);
    expect(point.wear.drivetrain).toBeCloseTo(point.km);
  });

  it('zählt keine Kilometer über das Saisonende hinaus', () => {
    expect(seasonAt(SEASON_KM + 500).km).toBe(SEASON_KM);
  });

  it('endet mit einer Kette, die fällig ist, während der Kilometerstand noch ok sagt', () => {
    const end = seasonAt(SEASON_KM);
    expect(warnStatus(end.wear.drivetrain / 2000)).toBe('critical');
    expect(warnStatus(end.km / 2000)).toBe('ok');
  });

  it('bleibt realistisch: höchstens gut ein Drittel der Kilometer ist nass', () => {
    const wet = SAMPLE_RIDES.filter((r) => r.precipitation > 0).reduce((s, r) => s + r.km, 0);
    expect(wet / SEASON_KM).toBeLessThan(0.4);
  });
});
