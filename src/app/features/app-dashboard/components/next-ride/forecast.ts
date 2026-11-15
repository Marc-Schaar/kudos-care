import { NextRideForecast, WarnStatus } from '../../../app-maintenance/models/maintenance.models';
import { DueItem } from '../../../app-maintenance/shared/utils/utils';

/**
 * Wie weit die Maßlinie höchstens reicht. Sie ist zeitmaßstäblich: morgen ist ein kurzer Strich,
 * in zehn Tagen ein langer. Darüber wird sie nicht länger, sondern bekommt eine Bruchkante, wie
 * das Verschleiß-Lineal über 125 %.
 */
export const RULER_DAYS = 14;

/** Ein Posten, den die nächste Fahrt über eine Grenze schiebt. */
export interface ForecastCheck {
  item: DueItem;
  then: WarnStatus;
  /** "dann überfällig" / "dann bald fällig" */
  change: string;
}

export interface ForecastRuler {
  days: number;
  /** Anteil der vollen Breite, 0–1. */
  span: number;
  /** Positionen der Tagesstriche zwischen den Enden, 0–1 relativ zur Linie. */
  ticks: number[];
  broken: boolean;
}

export type ForecastView =
  | { kind: 'pending'; sentence: string }
  | {
      kind: 'ready';
      sentence: string;
      date: string;
      /** "46 km", gerundet wie im Satz; leer, wenn die Strecke unbekannt ist. */
      km: string;
      ruler: ForecastRuler | null;
      /** Wie das Rad am Fahrtag dasteht: die Form am Ende der Linie. */
      tone: WarnStatus;
      checks: ForecastCheck[];
      /** Was schon heute fällig ist und darum nicht noch einmal in der Liste steht. */
      alreadyDue: number;
      basis: string;
    };

const RANK: Record<WarnStatus, number> = { unknown: 0, ok: 1, warn: 2, critical: 3 };

const km = (value: number): string => `${Math.round(value).toLocaleString('de-DE')} km`;

function when(days: number): string {
  if (days <= 0) return 'Heute';
  if (days === 1) return 'Morgen';
  if (days === 2) return 'Übermorgen';
  return `In ${days} Tagen`;
}

function rhythm(gapDays: number): string {
  const gap = Math.round(gapDays);
  if (gap <= 0) return 'meist mehrmals am Tag';
  if (gap === 1) return 'meist täglich';
  return `meist alle ${gap} Tage`;
}

function buildRuler(days: number): ForecastRuler | null {
  if (days <= 0) return null;
  const shown = Math.min(days, RULER_DAYS);
  const ticks = Array.from({ length: shown - 1 }, (_, i) => (i + 1) / shown);
  return { days, span: shown / RULER_DAYS, ticks, broken: days > RULER_DAYS };
}

/**
 * Die Prognose in Worten. Die Rechnung macht der Server (dieselbe Projektion wie die
 * Vorhersage-Mail); hier wird nur zugeordnet und formuliert. Titel und Restwert kommen aus den
 * schon geladenen `DueItem`s, damit dasselbe Teil nicht an zwei Stellen verschieden heißt.
 */
export function buildForecast(forecast: NextRideForecast, due: DueItem[]): ForecastView {
  if (!forecast.predicted_date) {
    const left = Math.max(forecast.min_rides - forecast.ride_count, 1);
    return {
      kind: 'pending',
      sentence:
        `Noch ${left === 1 ? 'eine Fahrt' : `${left} Fahrten`} mit diesem Rad, dann schätzt ` +
        'Kudos Care, wann du wieder fährst und was bis dahin fällig wird.',
    };
  }

  const days = forecast.days_until ?? 0;
  const distance = forecast.predicted_km ?? null;
  const tail = distance ? `, rund ${km(distance)}` : '';
  const sentence = forecast.is_overdue
    ? `Nach deinem Rhythmus wärst du schon wieder dran${tail}.`
    : `${when(days)} fährst du wahrscheinlich wieder${tail}.`;

  const byKey = new Map(due.map((item) => [item.key, item]));
  const checks: ForecastCheck[] = [];
  let alreadyDue = 0;
  let tone: WarnStatus = 'ok';
  for (const entry of forecast.items) {
    if (RANK[entry.status_then] > RANK[tone]) tone = entry.status_then;
    const item = byKey.get(`${entry.kind}-${entry.id}`);
    if (!item) continue;
    if (RANK[entry.status_then] <= RANK[entry.status_today]) {
      alreadyDue++;
      continue;
    }
    checks.push({
      item,
      then: entry.status_then,
      change: entry.status_then === 'critical' ? 'dann überfällig' : 'dann bald fällig',
    });
  }
  checks.sort((a, b) => RANK[b.then] - RANK[a.then] || (b.item.ratio ?? 0) - (a.item.ratio ?? 0));

  const count = forecast.rides_considered ?? 0;
  const basis =
    `Geschätzt aus deinen letzten ${count} Fahrten mit diesem Rad: ` +
    `${rhythm(forecast.median_gap_days ?? 0)}${distance ? `, meist ${km(distance)}` : ''}.`;

  return {
    kind: 'ready',
    sentence,
    date: forecast.predicted_date,
    km: distance ? km(distance) : '',
    ruler: forecast.is_overdue ? null : buildRuler(days),
    tone,
    checks,
    alreadyDue,
    basis,
  };
}
