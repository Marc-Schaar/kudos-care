import { Injectable, computed, inject } from '@angular/core';

import { DASH, fmtDistance, fmtTime, kmh, num } from '../core/format';
import { Gps } from '../core/gps';
import { Heading } from '../core/heading';
import { DataPageConfig } from '../core/models';
import { RideMetrics } from '../core/ride-metrics';
import { RideRecorder } from '../core/ride-recorder';
import { Sensors } from '../core/sensors';
import { SettingsStore } from '../core/settings-store';
import { sunTimes } from '../core/sun';
import { Ticker } from '../core/ticker';
import { Wind, compassPoint } from '../core/wind';
import { RouteGuide } from '../nav/route-guide';
import { WorkoutPlayer, describeTarget } from '../workout/workout-player';

export type FieldGroup =
  | 'Tempo und Strecke'
  | 'Leistung'
  | 'Puls und Kadenz'
  | 'Höhe'
  | 'Zeit'
  | 'Runde'
  | 'Navigation'
  | 'Training'
  | 'Wetter'
  | 'Extras';

export const FIELD_GROUPS: readonly FieldGroup[] = [
  'Tempo und Strecke',
  'Leistung',
  'Puls und Kadenz',
  'Höhe',
  'Zeit',
  'Runde',
  'Navigation',
  'Training',
  'Wetter',
  'Extras',
];

/**
 * Ein Datenfeld. `kind` unterscheidet Zahlenfelder von den beiden Kacheln mit eigener
 * Darstellung (Wind mit Pfeil, Klingel als Taste).
 */
export interface FieldDef {
  key: string;
  label: string;
  unit?: string;
  group: FieldGroup;
  /** Ein Satz für die Auswahl in den Einstellungen */
  hint?: string;
  kind?: 'value' | 'wind' | 'bell';
}

/** Wert eines Feldes; Beschriftung und Einheit dürfen sich mit dem Wert ändern. */
export interface FieldReading {
  value: string;
  label?: string;
  unit?: string;
  /**
   * Leistungszone 1–7 (Coggan) bei Leistungsfeldern: Das Feld zeigt sie als Zonen-Leitlinie
   * unter der Zahl. Fehlt ohne Messwert.
   */
  zone?: number;
}

export const FIELDS: readonly FieldDef[] = [
  { key: 'speed', label: 'Geschwindigkeit', unit: 'km/h', group: 'Tempo und Strecke' },
  { key: 'avgSpeed', label: 'Ø Geschwindigkeit', unit: 'km/h', group: 'Tempo und Strecke' },
  { key: 'maxSpeed', label: 'Max. Geschwindigkeit', unit: 'km/h', group: 'Tempo und Strecke' },
  { key: 'distance', label: 'Distanz', unit: 'km', group: 'Tempo und Strecke' },

  { key: 'power', label: 'Leistung', unit: 'W', group: 'Leistung', hint: 'Jede Sekunde neu' },
  { key: 'power3s', label: 'Leistung 3 s', unit: 'W', group: 'Leistung' },
  { key: 'power10s', label: 'Leistung 10 s', unit: 'W', group: 'Leistung' },
  { key: 'power30s', label: 'Leistung 30 s', unit: 'W', group: 'Leistung' },
  { key: 'avgPower', label: 'Ø Leistung', unit: 'W', group: 'Leistung' },
  { key: 'maxPower', label: 'Max. Leistung', unit: 'W', group: 'Leistung' },
  {
    key: 'np',
    label: 'Normalized Power',
    unit: 'W',
    group: 'Leistung',
    hint: 'Gewichtet Spitzen stärker, wie anstrengend die Fahrt war',
  },
  { key: 'ftpPct', label: '% FTP', unit: '%', group: 'Leistung', hint: 'Leistung 3 s zur FTP' },
  {
    key: 'powerZone',
    label: 'Leistungszone',
    group: 'Leistung',
    hint: 'Z1 bis Z7 nach Coggan, aus Leistung 3 s',
  },
  { key: 'intensity', label: 'Intensität (IF)', group: 'Leistung', hint: 'NP geteilt durch FTP' },
  { key: 'tss', label: 'TSS', group: 'Leistung', hint: 'Trainingsbelastung bis jetzt' },
  { key: 'work', label: 'Arbeit', unit: 'kJ', group: 'Leistung' },
  {
    key: 'kcal',
    label: 'Kalorien',
    unit: 'kcal',
    group: 'Leistung',
    hint: 'Aus der Arbeit: 1 kJ am Pedal kostet rund 1 kcal',
  },

  { key: 'hr', label: 'Puls', unit: 'bpm', group: 'Puls und Kadenz' },
  { key: 'avgHr', label: 'Ø Puls', unit: 'bpm', group: 'Puls und Kadenz' },
  { key: 'maxHr', label: 'Max. Puls', unit: 'bpm', group: 'Puls und Kadenz' },
  { key: 'cadence', label: 'Kadenz', unit: 'rpm', group: 'Puls und Kadenz' },
  {
    key: 'avgCadence',
    label: 'Ø Kadenz',
    unit: 'rpm',
    group: 'Puls und Kadenz',
    hint: 'Ohne Rollphasen',
  },

  { key: 'altitude', label: 'Höhe', unit: 'm', group: 'Höhe' },
  { key: 'ascent', label: 'Anstieg', unit: 'm', group: 'Höhe' },
  { key: 'descent', label: 'Abstieg', unit: 'm', group: 'Höhe' },
  { key: 'grade', label: 'Steigung', unit: '%', group: 'Höhe', hint: 'Über die letzten 150 m' },
  {
    key: 'vam',
    label: 'Steigrate',
    unit: 'm/h',
    group: 'Höhe',
    hint: 'Höhenmeter je Stunde, über die letzte Minute',
  },

  { key: 'time', label: 'Fahrzeit', group: 'Zeit' },
  { key: 'elapsed', label: 'Gesamtzeit', group: 'Zeit', hint: 'Seit dem Start, mit Pausen' },
  { key: 'clock', label: 'Uhrzeit', group: 'Zeit' },
  {
    key: 'daylight',
    label: 'Noch hell',
    group: 'Zeit',
    hint: 'Zeit bis Sonnenuntergang, ohne Netz berechnet',
  },
  { key: 'sunset', label: 'Sonnenuntergang', group: 'Zeit' },

  { key: 'lapTime', label: 'Rundenzeit', group: 'Runde' },
  { key: 'lapDist', label: 'Rundendistanz', unit: 'km', group: 'Runde' },
  { key: 'lapSpeed', label: 'Runde Ø', unit: 'km/h', group: 'Runde' },
  { key: 'lapPower', label: 'Runde Ø Leistung', unit: 'W', group: 'Runde' },
  { key: 'lastLapTime', label: 'Letzte Runde', group: 'Runde' },
  { key: 'lapCount', label: 'Runde Nr.', group: 'Runde' },

  { key: 'navNext', label: 'Abbiegen in', group: 'Navigation', hint: 'Mit der Richtung im Titel' },
  { key: 'navRemaining', label: 'Rest bis Ziel', group: 'Navigation' },
  { key: 'navEta', label: 'Ankunft', group: 'Navigation' },
  {
    key: 'heading',
    label: 'Richtung',
    group: 'Navigation',
    hint: 'Himmelsrichtung, im Stand per Kompass',
  },

  { key: 'woTarget', label: 'Zielleistung', unit: 'W', group: 'Training' },
  { key: 'woRemaining', label: 'Schritt endet in', group: 'Training' },
  { key: 'woStep', label: 'Trainingsschritt', group: 'Training' },

  {
    key: 'wind',
    label: 'Wind',
    group: 'Wetter',
    kind: 'wind',
    hint: 'Gegen- oder Rückenwind mit Pfeil',
  },
  {
    key: 'temperature',
    label: 'Temperatur',
    unit: '°C',
    group: 'Wetter',
    hint: 'Braucht die Wetter-Freigabe',
  },
  {
    key: 'rainNow',
    label: 'Regen jetzt',
    unit: 'mm/h',
    group: 'Wetter',
    hint: 'Niederschlag der letzten Viertelstunde',
  },

  { key: 'bell', label: 'Klingel', group: 'Extras', kind: 'bell', hint: 'Tippen klingelt' },
  { key: 'gpsAccuracy', label: 'GPS-Genauigkeit', unit: 'm', group: 'Extras' },
];

const BY_KEY = new Map(FIELDS.map((f) => [f.key, f]));

export function fieldDef(key: string): FieldDef | null {
  return BY_KEY.get(key) ?? null;
}

/** Die bisherigen drei Datenseiten: wer nichts einstellt, sieht keinen Unterschied. */
export const DEFAULT_PAGES: readonly DataPageConfig[] = [
  { name: 'Fahrt', fields: ['speed', 'power3s', 'hr', 'cadence', 'distance', 'time'] },
  { name: 'Schnitt', fields: ['avgSpeed', 'avgPower', 'maxPower', 'ascent', 'wind', 'elapsed'] },
  { name: 'Runde', fields: ['lapPower', 'lapTime', 'lapDist', 'lapSpeed', 'hr', 'power3s'] },
];

export const MAX_PAGES = 8;
export const MAX_FIELDS = 8;

/** Eigene Seiten, ohne unbekannte Felder (etwa von einer neueren App-Version). */
export function effectivePages(
  pages: readonly DataPageConfig[] | null | undefined,
): DataPageConfig[] {
  const own = (pages ?? [])
    .map((p) => ({
      name: p.name,
      fields: p.fields.filter((k) => BY_KEY.has(k)).slice(0, MAX_FIELDS),
    }))
    .filter((p) => p.fields.length > 0);
  return own.length ? own : DEFAULT_PAGES.map((p) => ({ ...p, fields: [...p.fields] }));
}

export type FieldSize = 'hero' | 'normal' | 'wide';

/**
 * Raster einer Datenseite: das erste Feld groß über die volle Breite, die übrigen
 * paarweise, ein übrig bleibendes über die ganze Breite. Bei sechs Feldern ist das genau
 * die bisherige Aufteilung.
 */
export function pageLayout(count: number): { sizes: FieldSize[]; rows: string } {
  if (count <= 1) return { sizes: ['hero'], rows: '1fr' };
  const rest = count - 1;
  const sizes: FieldSize[] = ['hero', ...Array<FieldSize>(rest).fill('normal')];
  if (rest % 2 === 1) sizes[count - 1] = 'wide';
  const pairs = Math.floor(rest / 2);
  const rows = ['1.45fr', ...Array<string>(pairs).fill('1fr')];
  if (rest % 2 === 1) rows.push('0.85fr');
  return { sizes, rows: rows.join(' ') };
}

/** Leistungszone nach Coggan aus dem Anteil an der FTP. */
export function powerZone(ratio: number): number {
  const limits = [0.55, 0.75, 0.9, 1.05, 1.2, 1.5];
  const i = limits.findIndex((limit) => ratio < limit);
  return i === -1 ? 7 : i + 1;
}

/**
 * Wert eines Leistungsfelds samt Zone. Nur Momentan- und Rundenleistung tragen eine Zone:
 * Beim Fahrtschnitt oder Maximum beantwortet sie keine Frage, die man unterwegs stellt.
 */
export function powerReading(watts: number | null, ftp: number): FieldReading {
  if (watts == null || !Number.isFinite(watts)) return { value: num(null) };
  return { value: num(watts), zone: powerZone(watts / ftp) };
}

/** „1:05“: Stunden und Minuten, ohne Sekunden. */
const hoursMinutes = (ms: number): string => {
  const minutes = Math.floor(ms / 60_000);
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
};

const clockTime = (ms: number): string =>
  new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

/** Werte aller Felder, einmal je Sekunde gerechnet und von jeder Datenseite geteilt. */
@Injectable({ providedIn: 'root' })
export class RideFields {
  private readonly ride = inject(RideRecorder);
  private readonly metrics = inject(RideMetrics);
  private readonly sensors = inject(Sensors);
  private readonly gps = inject(Gps);
  private readonly heading = inject(Heading);
  private readonly ticker = inject(Ticker);
  private readonly settings = inject(SettingsStore);
  private readonly guide = inject(RouteGuide);
  private readonly player = inject(WorkoutPlayer);
  private readonly wind = inject(Wind);

  /** Ändert sich nur mit der Position auf ein paar Kilometer: einmal je Tag und Ort. */
  private readonly sun = computed(() => {
    const fix = this.gps.fix();
    if (!fix) return null;
    const now = this.ticker.now();
    const day = new Date(now);
    day.setHours(12, 0, 0, 0);
    // Auf ~10 km gerundet, damit die Rechnung nicht bei jeder Position neu läuft.
    return sunTimes(day, Math.round(fix.lat * 10) / 10, Math.round(fix.lon * 10) / 10);
  });

  readonly readings = computed<Record<string, FieldReading>>(() => {
    const stats = this.ride.stats();
    const laps = this.ride.laps();
    const lap = laps[laps.length - 1];
    const totals = this.metrics.totals();
    const live = this.metrics.live();
    const now = this.ticker.now();
    const speed = this.gps.speed();
    const power3s = this.sensors.power3s();
    const ftp = this.settings.ftp();
    const lapMs = stats.movingMs - lap.t0;
    const lapM = stats.distanceM - lap.d0;
    const hours = stats.movingMs / 3_600_000;
    const intensity = totals.np != null ? totals.np / ftp : null;

    const progress = this.guide.progress();
    const avg =
      stats.movingMs > 60_000 ? stats.distanceM / (stats.movingMs / 1000) : this.gps.speed();
    const eta =
      progress && avg != null && avg >= 1.5
        ? clockTime(now + (progress.remainingM / avg) * 1000)
        : DASH;

    const sun = this.sun();
    const sunsetMs = sun?.sunset.valueOf() ?? null;
    const heading = this.heading.value();
    const step = this.player.step();
    const woRunning = this.player.status() === 'running' && step != null;
    const reading = this.wind.current();
    const prev = laps.length > 1 ? laps[laps.length - 2] : null;

    const v = (value: string): FieldReading => ({ value });
    return {
      speed: v(num(speed == null ? null : speed * 3.6, 1)),
      avgSpeed: v(num(kmh(stats.distanceM, stats.movingMs), 1)),
      maxSpeed: v(num(totals.maxSpeed == null ? null : totals.maxSpeed * 3.6, 1)),
      distance: v(num(stats.distanceM / 1000, 2)),

      power: powerReading(this.sensors.power(), ftp),
      power3s: powerReading(power3s, ftp),
      power10s: powerReading(this.metrics.power10s(), ftp),
      power30s: powerReading(this.metrics.power30s(), ftp),
      avgPower: v(num(stats.pwrN ? stats.pwrSum / stats.pwrN : null)),
      maxPower: v(num(stats.pwrN ? stats.pwrMax : null)),
      np: v(num(totals.np)),
      ftpPct: v(num(power3s == null ? null : (power3s / ftp) * 100)),
      powerZone: v(power3s == null ? DASH : `Z${powerZone(power3s / ftp)}`),
      intensity: v(num(intensity, 2)),
      tss: v(num(intensity == null ? null : hours * intensity * intensity * 100)),
      work: v(num(totals.workJ ? totals.workJ / 1000 : null)),
      kcal: v(num(totals.workJ ? totals.workJ / 1000 : null)),

      hr: v(num(this.sensors.hr())),
      avgHr: v(num(totals.avgHr)),
      maxHr: v(num(totals.maxHr)),
      cadence: v(num(this.sensors.cadence())),
      avgCadence: v(num(totals.avgCadence)),

      altitude: v(num(this.gps.position()?.alt ?? null)),
      ascent: v(num(stats.ascentM)),
      descent: v(num(totals.descentM)),
      grade: v(num(live.grade)),
      vam: v(num(live.vam)),

      time: v(fmtTime(stats.movingMs)),
      elapsed: v(fmtTime(stats.startedAt ? now - stats.startedAt : 0)),
      clock: v(clockTime(now)),
      daylight:
        sunsetMs == null
          ? v(DASH)
          : sunsetMs > now
            ? { value: hoursMinutes(sunsetMs - now), unit: 'h' }
            : { value: 'dunkel', label: 'Sonne ist unter' },
      sunset: v(sunsetMs == null ? DASH : clockTime(sunsetMs)),

      lapTime: v(fmtTime(lapMs)),
      lapDist: v(num(lapM / 1000, 2)),
      lapSpeed: v(num(kmh(lapM, lapMs), 1)),
      lapPower: powerReading(lap.pwrN ? lap.pwrSum / lap.pwrN : null, ftp),
      lastLapTime: v(prev ? fmtTime(lap.t0 - prev.t0) : DASH),
      lapCount: v(String(laps.length)),

      navNext:
        progress?.nextCue && progress.cueDistM != null && !progress.offRoute
          ? { value: fmtDistance(progress.cueDistM), label: progress.nextCue.text }
          : progress?.offRoute
            ? { value: fmtDistance(progress.offM), label: 'Route verlassen' }
            : v(DASH),
      navRemaining: v(progress ? fmtDistance(progress.remainingM) : DASH),
      navEta: v(eta),
      heading:
        heading == null
          ? v(DASH)
          : { value: compassPoint(heading), unit: `${Math.round(heading)}°` },

      woTarget: v(woRunning ? num(this.player.targetW()) : DASH),
      woRemaining: v(woRunning ? fmtTime(this.player.stepRemainingS() * 1000) : DASH),
      woStep: woRunning ? { value: describeTarget(step), label: step.label } : v(DASH),

      temperature: v(num(reading?.temperature_c ?? null, 1)),
      // Open-Meteo liefert die Summe der letzten 15 Minuten; mal vier ist die Stundenrate.
      rainNow: v(num(reading?.precipitation_mm == null ? null : reading.precipitation_mm * 4, 1)),

      gpsAccuracy: v(num(this.gps.accuracy())),
    };
  });
}
