import { Activity } from '../../../shared/services/strava-service/strava-service';

/**
 * Was sich aus `GET /activities/` ablesen lässt, ohne jede Fahrt einzeln zu laden. Reine
 * Funktionen, damit Startseite und Fahrtenliste dieselbe Antwort geben.
 */

/** Ab hier zählt eine Fahrt als nass: Nieselregen im Stundenmittel liegt darunter. */
export const WET_MM_PER_HOUR = 0.5;

export interface RideWeather {
  wet: boolean;
  avgPrecipitation: number | null;
  avgTemperature: number | null;
}

export function mean(values: (number | null | undefined)[] | undefined): number | null {
  const known = (values ?? []).filter((value): value is number => value != null);
  return known.length ? known.reduce((sum, value) => sum + value, 0) / known.length : null;
}

/** Null, wenn für die Fahrt keine Wetterdaten vorliegen (keine Einwilligung, alte Fahrt). */
export function rideWeather(activity: Activity): RideWeather | null {
  const data = activity.weather_data;
  if (!data) return null;
  const avgPrecipitation = mean(data.precipitation);
  return {
    wet: avgPrecipitation !== null && avgPrecipitation >= WET_MM_PER_HOUR,
    avgPrecipitation,
    avgTemperature: mean(data.temperature_2m),
  };
}

/** Pfad der Strecke in einem quadratischen Feld. Null ohne Track. */
export function routePath(track: string | null | undefined, size = 48, maxPoints = 40): string | null {
  const body = track?.match(/LINESTRING\s*\(([^)]*)\)/i)?.[1];
  if (!body) return null;

  const all = body.split(',').map((pair) => pair.trim().split(/\s+/).map(Number));
  const step = Math.max(1, Math.ceil(all.length / maxPoints));
  const points = all.filter((_, index) => index % step === 0 || index === all.length - 1);
  if (points.length < 2 || points.some(([lng, lat]) => !Number.isFinite(lng) || !Number.isFinite(lat))) {
    return null;
  }

  // Längengrade rücken nach Norden zusammen. Ohne Korrektur wäre jede Runde in die Breite gezogen.
  const lats = points.map(([, lat]) => lat);
  const squeeze = Math.cos((((Math.min(...lats) + Math.max(...lats)) / 2) * Math.PI) / 180);
  const xs = points.map(([lng]) => lng * squeeze);
  const minX = Math.min(...xs);
  const maxLat = Math.max(...lats);
  const width = Math.max(...xs) - minX;
  const height = maxLat - Math.min(...lats);
  const span = Math.max(width, height);
  if (span === 0) return null;

  const padding = 2;
  const scale = (size - padding * 2) / span;
  const offsetX = (size - width * scale) / 2;
  const offsetY = (size - height * scale) / 2;

  return points
    .map(([, lat], index) => {
      const x = offsetX + (xs[index] - minX) * scale;
      const y = offsetY + (maxLat - lat) * scale;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join('');
}

export function rideKm(activity: Activity): number {
  return (activity.distance ?? 0) / 1000;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '–';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours === 0) return `${minutes} min`;
  return `${hours} h ${minutes.toString().padStart(2, '0')} min`;
}

export interface MonthGroup {
  key: string;
  label: string;
  rides: Activity[];
  km: number;
}

const monthFormat = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });

/** Neueste zuerst. Fahrten ohne Datum landen am Ende in einer eigenen Gruppe. */
export function groupByMonth(activities: Activity[]): MonthGroup[] {
  const groups = new Map<string, MonthGroup>();
  const sorted = [...activities].sort(
    (a, b) => Date.parse(b.start_date ?? '') - Date.parse(a.start_date ?? '') || 0,
  );
  for (const ride of sorted) {
    const date = ride.start_date ? new Date(ride.start_date) : null;
    const key = date ? `${date.getFullYear()}-${date.getMonth()}` : 'none';
    const group =
      groups.get(key) ??
      ({ key, label: date ? monthFormat.format(date) : 'Ohne Datum', rides: [], km: 0 } as MonthGroup);
    group.rides.push(ride);
    group.km += rideKm(ride);
    groups.set(key, group);
  }
  return [...groups.values()];
}

const DAY_MS = 86_400_000;

export interface TallyMark {
  id: number;
  name: string;
  date: Date;
  km: number;
  wet: boolean;
  /** Lage auf der Zeitachse in Prozent. */
  x: number;
  /** Höhe relativ zur längsten Fahrt im Fenster, in Prozent. */
  height: number;
}

export interface Tally {
  marks: TallyMark[];
  ticks: { label: string; x: number }[];
  totalKm: number;
  wetCount: number;
}

const tickFormat = new Intl.DateTimeFormat('de-DE', { month: 'short' });

/**
 * Die Strichliste: jede Fahrt ein Strich auf der Zeitachse, nasse hervorgehoben. Das Fenster endet
 * heute, außer es liegt keine Fahrt darin: dann endet es bei der letzten Fahrt, sonst bliebe nach
 * einer Winterpause eine leere Fläche stehen.
 */
export function buildTally(activities: Activity[], now: Date, months = 6): Tally {
  const dated = activities.filter((ride) => ride.start_date);
  const latest = Math.max(...dated.map((ride) => Date.parse(ride.start_date!)), 0);
  const windowDays = Math.round(months * 30.44);

  let end = now.getTime();
  if (latest && end - latest > windowDays * DAY_MS) end = latest;
  const start = end - windowDays * DAY_MS;

  const rides = dated.filter((ride) => {
    const time = Date.parse(ride.start_date!);
    return time >= start && time <= end;
  });
  const longest = Math.max(...rides.map(rideKm), 1);

  const marks = rides.map((ride) => {
    const date = new Date(ride.start_date!);
    return {
      id: ride.id,
      name: ride.name,
      date,
      km: rideKm(ride),
      wet: rideWeather(ride)?.wet ?? false,
      x: ((date.getTime() - start) / (end - start)) * 100,
      // Auch die kürzeste Fahrt bleibt als Strich lesbar.
      height: Math.max(14, (rideKm(ride) / longest) * 100),
    };
  });

  const ticks: Tally['ticks'] = [];
  const cursor = new Date(start);
  cursor.setDate(1);
  cursor.setMonth(cursor.getMonth() + 1);
  cursor.setHours(0, 0, 0, 0);
  while (cursor.getTime() < end) {
    const x = ((cursor.getTime() - start) / (end - start)) * 100;
    if (x > 3 && x < 97) ticks.push({ label: tickFormat.format(cursor).replace('.', ''), x });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return {
    marks,
    ticks,
    totalKm: marks.reduce((sum, mark) => sum + mark.km, 0),
    wetCount: marks.filter((mark) => mark.wet).length,
  };
}
