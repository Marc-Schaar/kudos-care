import { RideDayWeather } from '../../../app-maintenance/models/maintenance.models';

/**
 * Der kurze Wetterbericht für den Fahrtag, als Randnotiz unter der Maßlinie. Die Rechnung macht
 * der Server (`ride_day_weather`), hier wird nur formuliert. Gleiche Wortwahl wie die
 * Vorhersage-Mail (`app_notifications/presentation.py::weather_note`) — Änderungen dort
 * nachziehen, damit App und Mail dasselbe sagen.
 */
export type WeatherView =
  | { kind: 'none' }
  | { kind: 'consent' }
  | {
      kind: 'ready';
      condition: string | null;
      temperature: string;
      rain: string | null;
      wind: string;
      /** Wohin der Pfeil zeigt (Strömungsrichtung), 0 = oben; null ohne Richtung. */
      arrow: number | null;
      windLabel: string;
      wear: string;
      /** Mit Wetteraufschlag "warn", sonst "ok": färbt nur den Verschleiß-Satz. */
      tone: 'ok' | 'warn';
    };

const num = (value: number): string => Math.round(value).toLocaleString('de-DE');
const temp = (value: number): string => num(value).replace('-', '−');

export function buildWeather(weather: RideDayWeather | undefined): WeatherView {
  if (!weather) return { kind: 'none' };
  if (weather.status === 'consent_required') return { kind: 'consent' };
  const r = weather.report;
  if (weather.status !== 'ok' || !r) return { kind: 'none' };

  const low = temp(r.temp_min);
  const high = temp(r.temp_max);

  let rain: string | null = null;
  if (r.precipitation_probability !== null) {
    rain = `${r.precipitation_probability} % Regenrisiko`;
    if (r.precipitation_mm >= 0.5) {
      rain += `, ${r.precipitation_mm.toLocaleString('de-DE', { maximumFractionDigits: 1 })} mm`;
    }
  }

  let wind = `${num(r.wind_kmh)} km/h`;
  if (r.gusts_kmh) wind += `, Böen ${num(r.gusts_kmh)}`;
  const windLabel = r.wind_from ? `Wind aus ${r.wind_from}` : 'Wind';

  return {
    kind: 'ready',
    condition: r.condition,
    temperature: low === high ? `${low} °C` : `${low} bis ${high} °C`,
    rain,
    wind,
    arrow: r.wind_direction_deg === null ? null : (r.wind_direction_deg + 180) % 360,
    windLabel,
    wear: r.wear.text,
    tone: r.wear.driver ? 'warn' : 'ok',
  };
}
