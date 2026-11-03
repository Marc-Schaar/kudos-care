/**
 * Die Verschleiß-Formel der App, für den Rechner auf der Landing-Page.
 *
 * Spiegelt `WeatherWearCalculator` aus `app_maintenance/api/services.py` samt den
 * Koeffizienten aus Migration `0006` im Backend. Es gibt dafür keinen öffentlichen
 * Endpoint, und die Seite soll ohne Anmeldung rechnen. Ändert sich dort etwas, muss
 * es hier nachgezogen werden. `wear-formula.spec.ts` hält die Eckwerte fest.
 *
 * Die Gewichte sind heuristische Startwerte und noch nicht an Nutzerdaten kalibriert.
 * Die Seite sagt das auch.
 */

export type WearCategory = 'drivetrain' | 'brakes' | 'wheels' | 'suspension' | 'cockpit';
export type WeatherDriver = 'rain' | 'heat' | 'cold' | 'wind';
export type WarnStatus = 'ok' | 'warn' | 'critical';

export interface Weather {
  /** mm/h */
  precipitation: number;
  /** °C */
  temperature: number;
  /** km/h */
  windSpeed: number;
}

type Sensitivity = Record<WeatherDriver, number>;

const RAIN_REF_MM_H = 2.5;
const RAIN_FACTOR_CAP = 3;
const HEAT_THRESHOLD_C = 28;
const HEAT_REF_DELTA_C = 10;
const HEAT_FACTOR_CAP = 2;
const COLD_THRESHOLD_C = 5;
const COLD_REF_DELTA_C = 15;
const COLD_FACTOR_CAP = 2;
const WIND_THRESHOLD_KMH = 20;
const WIND_REF_DELTA_KMH = 20;
const WIND_FACTOR_CAP = 1;
const MAX_MULTIPLIER = 2;

const SENSITIVITY: Record<WearCategory, Sensitivity> = {
  drivetrain: { rain: 0.9, heat: 0.05, cold: 0.05, wind: 0.1 },
  brakes: { rain: 0.55, heat: 0.05, cold: 0.1, wind: 0.05 },
  wheels: { rain: 0.35, heat: 0.55, cold: 0.45, wind: 0.05 },
  suspension: { rain: 0.75, heat: 0.3, cold: 0.25, wind: 0.05 },
  cockpit: { rain: 0.25, heat: 0.1, cold: 0.1, wind: 0 },
};

export interface WearResult {
  multiplier: number;
  /** Stärkster Einzelbeitrag, `null` wenn das Wetter neutral ist. */
  driver: WeatherDriver | null;
}

const clamp = (value: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, value));

export function rideMultiplier(weather: Weather, category: WearCategory): WearResult {
  const coeff = SENSITIVITY[category];
  const { precipitation, temperature, windSpeed } = weather;

  const rain = clamp(precipitation / RAIN_REF_MM_H, 0, RAIN_FACTOR_CAP);
  const heat =
    temperature > HEAT_THRESHOLD_C
      ? clamp((temperature - HEAT_THRESHOLD_C) / HEAT_REF_DELTA_C, 0, HEAT_FACTOR_CAP)
      : 0;
  const cold =
    temperature < COLD_THRESHOLD_C
      ? clamp((COLD_THRESHOLD_C - temperature) / COLD_REF_DELTA_C, 0, COLD_FACTOR_CAP)
      : 0;
  const wind =
    windSpeed > WIND_THRESHOLD_KMH
      ? clamp((windSpeed - WIND_THRESHOLD_KMH) / WIND_REF_DELTA_KMH, 0, WIND_FACTOR_CAP)
      : 0;

  const contributions: Record<WeatherDriver, number> = {
    rain: coeff.rain * rain,
    heat: coeff.heat * heat,
    cold: coeff.cold * cold,
    wind: coeff.wind * wind,
  };
  const drivers = Object.keys(contributions) as WeatherDriver[];
  const dominant = drivers.reduce((best, key) =>
    contributions[key] > contributions[best] ? key : best,
  );
  const raw = 1 + drivers.reduce((sum, key) => sum + contributions[key], 0);

  return {
    multiplier: clamp(raw, 1, MAX_MULTIPLIER),
    driver: contributions[dominant] > 0 ? dominant : null,
  };
}

/** Wie `warn_status_from_ratio()` im Backend: ab 80 % warn, ab 100 % kritisch. */
export function warnStatus(ratio: number): WarnStatus {
  if (ratio >= 1) return 'critical';
  if (ratio >= 0.8) return 'warn';
  return 'ok';
}
