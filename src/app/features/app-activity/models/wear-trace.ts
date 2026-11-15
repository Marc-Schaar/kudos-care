import { WearImpactBreakdown, WearImpactCategory } from './wear-impact';
import { profileSegments, ProfileSegment } from './wind-profile';
import { WindSegmentCollection } from './wind-segments';

/**
 * Der Verschleiß entlang der Strecke: wie sich der Aufschlag einer Kategorie über die
 * Fahrt aufbaut.
 *
 * Gerechnet wird hier nichts. Das Backend verteilt den `extra_km` der Kategorie auf die
 * Windabschnitte (`attach_segment_wear`), die Summe ist also genau die Zahl der
 * Aufschlüsselung. Hier wird nur aufsummiert und abgelesen.
 */

export interface TracePoint {
  index: number;
  startKm: number;
  endKm: number;
  /** Aufschlag in diesem Abschnitt, km. */
  extraKm: number;
  /** Verschleiß bis zum Ende dieses Abschnitts: gefahren plus Aufschlag. */
  wearKm: number;
  /** Wie viel jeder Kilometer hier zählte. */
  factor: number;
  props: ProfileSegment['props'];
}

/**
 * Kategorien, deren Verlauf sich zeigen lässt: mit Aufschlag und mit einer Verteilung,
 * die zu den Abschnitten passt. Passt die Länge nicht, zeigen wir lieber nichts als
 * einen verschobenen Verlauf.
 */
export function traceCategories(
  breakdown: WearImpactBreakdown | null,
  collection: WindSegmentCollection | null,
): WearImpactCategory[] {
  const count = collection?.features?.length ?? 0;
  if (!breakdown || !count) return [];
  return breakdown.categories.filter(
    (cat) => cat.extra_km > 0 && cat.segment_extra_km?.length === count,
  );
}

export function wearTrace(
  collection: WindSegmentCollection | null,
  rideKm: number | null,
  segmentExtraKm: readonly number[],
): TracePoint[] {
  let wear = 0;
  return profileSegments(collection, rideKm).map((row) => {
    const length = row.endKm - row.startKm;
    const extraKm = Math.max(0, segmentExtraKm[row.index] ?? 0);
    wear += length + extraKm;
    return {
      index: row.index,
      startKm: row.startKm,
      endKm: row.endKm,
      extraKm,
      wearKm: wear,
      factor: length > 0 ? 1 + extraKm / length : 1,
      props: row.props,
    };
  });
}

/** Verschleiß bis `km`, innerhalb eines Abschnitts linear. */
export function wearAtKm(points: readonly TracePoint[], km: number): number {
  let before = 0;
  for (const point of points) {
    if (km <= point.startKm) return before;
    if (km < point.endKm) return before + (km - point.startKm) * point.factor;
    before = point.wearKm;
  }
  return before;
}

/**
 * Die kürzeste zusammenhängende Strecke, auf der mindestens `share` des Aufschlags
 * entstand. Beantwortet „wo hat es mich erwischt", ohne den Nutzer das Diagramm
 * auswerten zu lassen.
 */
export function densestSpan(
  points: readonly TracePoint[],
  share = 0.5,
): { startKm: number; endKm: number } | null {
  const total = points.reduce((sum, p) => sum + p.extraKm, 0);
  if (total <= 0) return null;
  const target = total * share - 1e-9;

  let best: { startKm: number; endKm: number } | null = null;
  let sum = 0;
  let left = 0;
  for (let right = 0; right < points.length; right++) {
    sum += points[right].extraKm;
    while (sum - points[left].extraKm >= target && left < right) {
      sum -= points[left].extraKm;
      left++;
    }
    if (sum >= target) {
      const span = { startKm: points[left].startKm, endKm: points[right].endKm };
      if (!best || span.endKm - span.startKm < best.endKm - best.startKm) best = span;
    }
  }
  return best;
}
