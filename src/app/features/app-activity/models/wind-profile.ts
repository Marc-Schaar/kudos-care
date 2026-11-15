import { WindSegmentCollection, WindSegmentProperties } from './wind-segments';

/**
 * Das Windprofil: die Fahrt auf eine Distanzachse abgerollt, wie ein Höhenprofil. Reine
 * Funktionen über `wind_segments`, damit Profil, Karte und Befund-Satz aus derselben Quelle
 * lesen und dieselben Zahlen nennen.
 */

export type ProfileMode = 'wind' | 'rain';

/**
 * Unterhalb dieser Stärke (km/h) zählt ein Abschnitt weder als Gegen- noch als Rückenwind.
 * Höher als die Schwelle der `headwindLabel`-Pipe: die beurteilt einen Durchschnitt, hier
 * geht es um einzelne Abschnitte, in denen Seitenwind kleine Reste in Fahrtrichtung lässt.
 */
export const CROSSWIND_KMH = 2;

/**
 * Untergrenze der Regenskala in mm/h. Wind wird bewusst relativ zur Fahrt skaliert, Regen nicht
 * ganz: sonst füllt Niesel von 0,1 mm/h die volle Höhe und sieht aus wie ein Wolkenbruch. Karte
 * und Profil müssen dieselbe Grenze benutzen.
 */
export const RAIN_SCALE_FLOOR_MM = 1;

export interface ProfileSegment {
  index: number;
  startKm: number;
  endKm: number;
  props: WindSegmentProperties;
}

/**
 * Abschnitte in Fahrtreihenfolge, mit ihrer Lage auf der Distanzachse.
 *
 * Mit `rideKm` wird die Achse auf die Distanz gestreckt, die Strava für die Fahrt meldet. Die
 * Abschnittslängen kommen aus dem GPS-Stream und weichen davon ab (gemessen: 16,8 statt
 * 15,8 km); ohne Angleich nennte dieselbe Seite zwei Längen für dieselbe Fahrt.
 */
export function profileSegments(
  collection: WindSegmentCollection | null,
  rideKm?: number | null,
): ProfileSegment[] {
  const features = [...(collection?.features ?? [])].sort(
    (a, b) => a.properties.index - b.properties.index,
  );
  const measured = features.reduce((sum, f) => sum + (f.properties.distance_km ?? 0), 0);
  const scale = rideKm && rideKm > 0 && measured > 0 ? rideKm / measured : 1;
  let km = 0;
  return features.map((feature) => {
    const startKm = km;
    km += (feature.properties.distance_km ?? 0) * scale;
    return { index: feature.properties.index, startKm, endKm: km, props: feature.properties };
  });
}

export function profileValue(segment: ProfileSegment, mode: ProfileMode): number | null {
  return mode === 'rain' ? segment.props.precipitation : segment.props.headwind;
}

export function hasProfileData(segments: ProfileSegment[], mode: ProfileMode): boolean {
  return segments.some((segment) => profileValue(segment, mode) != null);
}

/** Der Abschnitt, der am meisten gegen dich war bzw. in dem es am stärksten regnete. */
export function peakSegment(segments: ProfileSegment[], mode: ProfileMode): ProfileSegment | null {
  let peak: ProfileSegment | null = null;
  for (const segment of segments) {
    const value = profileValue(segment, mode);
    if (value == null || value <= 0) continue;
    if (!peak || value > (profileValue(peak, mode) ?? 0)) peak = segment;
  }
  return peak;
}

export interface WindVerdict {
  headwindKm: number;
  tailwindKm: number;
  totalKm: number;
}

/** Null, wenn kein Abschnitt Winddaten hat: dann gibt es nichts zu behaupten. */
export function windVerdict(segments: ProfileSegment[]): WindVerdict | null {
  if (!hasProfileData(segments, 'wind')) return null;
  const verdict = { headwindKm: 0, tailwindKm: 0, totalKm: 0 };
  for (const segment of segments) {
    const length = segment.endKm - segment.startKm;
    const headwind = segment.props.headwind;
    verdict.totalKm += length;
    if (headwind == null) continue;
    if (headwind >= CROSSWIND_KMH) verdict.headwindKm += length;
    else if (headwind <= -CROSSWIND_KMH) verdict.tailwindKm += length;
  }
  return verdict;
}

const one = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });

export function verdictSentence(verdict: WindVerdict): string {
  const headwind = Math.round(verdict.headwindKm);
  if (headwind === 0) return 'Kein Kilometer gegen den Wind.';
  return `${whole.format(headwind)} von ${whole.format(verdict.totalKm)} km gegen den Wind.`;
}

const COMPASS = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];

export function compass(degrees: number): string {
  return COMPASS[Math.round((((degrees % 360) + 360) % 360) / 45) % 8];
}

function kmRange(segment: ProfileSegment): string {
  return `km ${one.format(segment.startKm)} bis ${one.format(segment.endKm)}`;
}

/** Der Satz zu einem Abschnitt, den man im Profil oder auf der Karte angetippt hat. */
export function segmentSentence(segment: ProfileSegment, mode: ProfileMode): string {
  const p = segment.props;
  if (mode === 'rain') {
    if (p.precipitation == null) return `${kmRange(segment)}: keine Regendaten.`;
    if (p.precipitation <= 0) return `${kmRange(segment)}: trocken.`;
    return `${kmRange(segment)}: ${one.format(p.precipitation)} mm/h Regen.`;
  }

  if (p.headwind == null) return `${kmRange(segment)}: keine Winddaten.`;
  const direction =
    p.wind_direction != null && p.bearing != null
      ? ` Wind aus ${compass(p.wind_direction)}, du fuhrst nach ${compass(p.bearing)}.`
      : '';
  if (Math.abs(p.headwind) < CROSSWIND_KMH) {
    const speed = p.wind_speed != null ? `, ${whole.format(p.wind_speed)} km/h` : '';
    return `${kmRange(segment)}: Wind von der Seite${speed}.${direction}`;
  }
  const kind = p.headwind > 0 ? 'Gegenwind' : 'Rückenwind';
  return `${kmRange(segment)}: ${one.format(Math.abs(p.headwind))} km/h ${kind}.${direction}`;
}

/** Was das Profil sagt, solange nichts angetippt ist: die Stelle, auf die es ankommt. */
export function idleSentence(segments: ProfileSegment[], mode: ProfileMode): string {
  const peak = peakSegment(segments, mode);
  if (mode === 'rain') {
    if (!peak) return 'Auf der ganzen Strecke trocken.';
    return `Am meisten Regen ab km ${one.format(peak.startKm)}: ${one.format(peak.props.precipitation ?? 0)} mm/h.`;
  }
  if (!peak || (peak.props.headwind ?? 0) < CROSSWIND_KMH) {
    return 'Nirgends nennenswerter Gegenwind.';
  }
  return `Am stärksten gegen dich ab km ${one.format(peak.startKm)}: ${one.format(peak.props.headwind ?? 0)} km/h.`;
}

/** Ein Lineal mit runden Abständen und vier bis sieben Teilstrichen. */
export function rulerTicks(totalKm: number): number[] {
  if (totalKm <= 0) return [0];
  const step = [1, 2, 5, 10, 20, 25, 50, 100].find((s) => totalKm / s <= 6) ?? 200;
  const ticks: number[] = [];
  for (let km = 0; km <= totalKm + 1e-9; km += step) ticks.push(km);
  return ticks;
}

export function segmentAtKm(segments: ProfileSegment[], km: number): ProfileSegment | null {
  if (!segments.length) return null;
  return (
    segments.find((segment) => km >= segment.startKm && km < segment.endKm) ??
    (km < 0 ? segments[0] : segments[segments.length - 1])
  );
}
