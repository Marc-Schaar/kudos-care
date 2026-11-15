import { describe, expect, it } from 'vitest';
import {
  RideDayWeather,
  RideDayWeatherReport,
} from '../../../app-maintenance/models/maintenance.models';
import { buildWeather } from './weather';

function report(overrides: Partial<RideDayWeatherReport> = {}): RideDayWeatherReport {
  return {
    date: '2026-11-19',
    condition: 'Regen',
    weather_code: 61,
    temp_min: 4.2,
    temp_max: 9.6,
    precipitation_mm: 3.4,
    precipitation_probability: 70,
    wind_kmh: 24,
    gusts_kmh: 46,
    wind_direction_deg: 270,
    wind_from: 'West',
    wear: {
      extra_pct: 45,
      category: 'drivetrain',
      driver: 'rain',
      text: 'Bei Nässe verschleißt der Antrieb etwa 45 % schneller.',
    },
    ...overrides,
  };
}

const ok = (r: RideDayWeatherReport): RideDayWeather => ({ status: 'ok', report: r });

describe('buildWeather', () => {
  it('formuliert wie die Mail', () => {
    const view = buildWeather(ok(report()));
    expect(view).toMatchObject({
      kind: 'ready',
      condition: 'Regen',
      temperature: '4 bis 10 °C',
      rain: '70 % Regenrisiko, 3,4 mm',
      windLabel: 'Wind aus West',
      wind: '24 km/h, Böen 46',
      tone: 'warn',
    });
  });

  it('zeigt den Pfeil in Strömungsrichtung: Westwind weht nach Osten', () => {
    const view = buildWeather(ok(report({ wind_direction_deg: 270 })));
    expect(view.kind === 'ready' && view.arrow).toBe(90);
  });

  it('lässt Kleinstmengen Regen und gleiche Temperaturen knapp', () => {
    const view = buildWeather(
      ok(report({ precipitation_mm: 0.2, temp_min: -1.2, temp_max: -0.8 })),
    );
    expect(view).toMatchObject({ rain: '70 % Regenrisiko', temperature: '−1 °C' });
  });

  it('färbt den Verschleiß-Satz nur mit Wetteraufschlag', () => {
    const calm = report({
      wear: { extra_pct: 0, category: null, driver: null, text: 'Kein Wetteraufschlag.' },
    });
    expect(buildWeather(ok(calm))).toMatchObject({ tone: 'ok' });
  });

  it('erklärt nur die fehlende Einwilligung, andere Gründe bleiben still', () => {
    expect(buildWeather({ status: 'consent_required', report: null }).kind).toBe('consent');
    expect(buildWeather({ status: 'out_of_range', report: null }).kind).toBe('none');
    expect(buildWeather({ status: 'unavailable', report: null }).kind).toBe('none');
    expect(buildWeather(undefined).kind).toBe('none');
  });
});
