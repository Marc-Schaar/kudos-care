import {
  BikeAssembly,
  BikeType,
  MountPosition,
  WarnStatus,
} from '../../models/maintenance.models';
import { buildDueList, weatherSurplusKm } from './utils';

/**
 * Die Rechnung hinter der Werkstattzeichnung (`bike-blueprint`): welche Baugruppe sitzt wo am
 * Rad, und wie laufen die Hinweislinien, ohne sich zu kreuzen.
 *
 * Die Stelle kommt aus `group_detail.category` und `.position`, nie aus dem Namen. Namen sind
 * frei änderbar, und die erste Fassung dieser Zeichnung hat genau daran Teile auf das falsche
 * Laufrad gesetzt.
 */

export interface Point {
  x: number;
  y: number;
}

/** Die Illustrationen in `public/bike-illustrations/` haben alle einen 400 × 200 Rahmen. */
const REAR_HUB: Point = { x: 94, y: 134 };
const FRONT_HUB: Point = { x: 312, y: 134 };
const BOTTOM_BRACKET: Point = { x: 178, y: 141 };

const DROP_BAR: BikeType[] = ['road', 'gravel', 'cx', 'ebike_road', 'triathlon'];
const SUSPENSION: BikeType[] = ['mtb', 'ebike_mtb'];

/** Punkte, die vom Rahmen abhängen. Muss zu den Proportionen der SVGs passen. */
function frameLandmarks(type: BikeType): { seat: Point; stem: Point; headBottom: Point } {
  if (DROP_BAR.includes(type)) {
    return { seat: { x: 154, y: 46 }, stem: { x: 294, y: 30 }, headBottom: { x: 287, y: 66 } };
  }
  if (SUSPENSION.includes(type)) {
    return { seat: { x: 154, y: 40 }, stem: { x: 287, y: 24 }, headBottom: { x: 281, y: 65 } };
  }
  return { seat: { x: 154, y: 44 }, stem: { x: 283, y: 10 }, headBottom: { x: 290, y: 68 } };
}

const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** Wo die Baugruppe in der 400 × 200-Illustration sitzt. Null: sie hat keinen festen Platz. */
export function anchorFor(
  category: string,
  position: MountPosition,
  type: BikeType,
): Point | null {
  const { seat, stem, headBottom } = frameLandmarks(type);
  const rear = position === 'rear';

  switch (category) {
    case 'wheels':
      // Auf dem Reifen, oben außen: dort kommt die Hinweislinie von der Seite an.
      return rear ? { x: 53, y: 93 } : { x: 353, y: 93 };
    case 'brakes':
      return rear ? REAR_HUB : FRONT_HUB;
    case 'drivetrain':
      return BOTTOM_BRACKET;
    case 'cockpit':
      return stem;
    case 'frame':
      // Am Steuerrohr: zur Rahmenmitte liefe die Linie quer durchs Vorderrad.
      return headBottom;
    case 'suspension':
      return rear ? midpoint(seat, BOTTOM_BRACKET) : midpoint(headBottom, FRONT_HUB);
    case 'electric':
      return { x: 222, y: 96 };
    case 'lighting':
      return rear ? { x: seat.x - 6, y: seat.y + 10 } : headBottom;
    default:
      return null;
  }
}

// ── Die zwei Fassungen der Zeichnung ─────────────────────────────────────────

/** Breit: das Rad in der Mitte, die Beschriftung links und rechts daneben. */
export const WIDE = { w: 1000, h: 440, bikeX: 225, bikeY: 44, scale: 1.375, columnEdge: 205 };
/** Schmal: nur das Rad mit Nummern, die Beschriftung steht darunter als Liste. */
export const NARROW = { w: 400, h: 248, bikeX: 0, bikeY: 0, scale: 1 };

const toWide = (point: Point): Point => ({
  x: WIDE.bikeX + point.x * WIDE.scale,
  y: WIDE.bikeY + point.y * WIDE.scale,
});

export type CalloutSide = 'left' | 'right';

export interface Callout {
  id: number;
  name: string;
  status: WarnStatus;
  /** Das Dringendste dieser Baugruppe in einer Zeile. */
  note: string;
  /** Laufende Nummer im Handbuch-Stil, null ohne festen Platz. */
  number: number | null;
  side: CalloutSide;
  /** Höhe der Beschriftung in der breiten Fassung. */
  labelY: number;
  /** Hinweislinie in der breiten Fassung, null ohne festen Platz. */
  leader: string | null;
  anchorWide: Point | null;
  /** Lage der Nummer in der schmalen Fassung. */
  anchorNarrow: Point | null;
}

function noteFor(assembly: BikeAssembly): string {
  const worst = buildDueList([assembly])[0];
  if (!worst) return 'Keine Teile eingetragen';
  if (!worst.remaining) return worst.title;
  // Die Zahl zuerst: wird die Zeile abgeschnitten, fällt der Name weg und nicht die Aussage.
  return `${worst.remaining} · ${worst.title}`;
}

const LABEL_CENTER = WIDE.h / 2;
const LABEL_SPREAD = 360;
const LABEL_MAX_GAP = 84;

/** Verteilt `count` Beschriftungen gleichmäßig um die Mitte, damit keine am Rand klebt. */
function labelPositions(count: number): number[] {
  if (count <= 1) return [LABEL_CENTER];
  const gap = Math.min(LABEL_MAX_GAP, LABEL_SPREAD / (count - 1));
  const top = LABEL_CENTER - (gap * (count - 1)) / 2;
  return Array.from({ length: count }, (_, i) => top + gap * i);
}

function leaderPath(side: CalloutSide, labelY: number, anchor: Point): string {
  const edge = side === 'left' ? WIDE.columnEdge : WIDE.w - WIDE.columnEdge;
  const elbow = side === 'left' ? edge + 14 : edge - 14;
  return `M${edge} ${labelY} L${elbow} ${labelY} L${anchor.x} ${anchor.y}`;
}

/** Schiebt Nummern auseinander, die sonst übereinander lägen. */
function spreadNumbers(points: (Point | null)[]): (Point | null)[] {
  const placed: Point[] = [];
  return points.map((point) => {
    if (!point) return null;
    const next = { ...point };
    while (placed.some((other) => Math.hypot(other.x - next.x, other.y - next.y) < 22)) {
      next.x += 22;
    }
    placed.push(next);
    return next;
  });
}

/**
 * Baut die Beschriftung: je Seite von oben nach unten sortiert nach der Höhe des Punkts am Rad.
 * Linien gleicher Reihenfolge kreuzen sich nicht. Baugruppen ohne festen Platz kommen ans Ende
 * der kürzeren Seite und bekommen keine Linie: eine Linie, die auf nichts zeigt, wäre gelogen.
 */
export function buildCallouts(assemblies: BikeAssembly[], type: BikeType): Callout[] {
  const entries = assemblies.map((assembly) => ({
    assembly,
    anchor: anchorFor(assembly.group_detail.category, assembly.group_detail.position, type),
  }));

  const placed = entries.filter((entry) => entry.anchor !== null);
  const middle = (REAR_HUB.x + FRONT_HUB.x) / 2;
  const byHeight = (a: (typeof entries)[number], b: (typeof entries)[number]): number =>
    a.anchor!.y - b.anchor!.y;
  const left = placed.filter((entry) => entry.anchor!.x < middle).sort(byHeight);
  const right = placed.filter((entry) => entry.anchor!.x >= middle).sort(byHeight);

  for (const entry of entries.filter((item) => item.anchor === null)) {
    (left.length <= right.length ? left : right).push(entry);
  }

  let number = 0;
  const build = (column: typeof entries, side: CalloutSide): Callout[] => {
    const positions = labelPositions(column.length);
    return column.map((entry, index) => {
      const labelY = positions[index];
      const anchorWide = entry.anchor ? toWide(entry.anchor) : null;
      return {
        id: entry.assembly.id,
        name: entry.assembly.display_name,
        status: entry.assembly.worst_status,
        note: noteFor(entry.assembly),
        number: entry.anchor ? ++number : null,
        side,
        labelY,
        leader: anchorWide ? leaderPath(side, labelY, anchorWide) : null,
        anchorWide,
        anchorNarrow: entry.anchor,
      };
    });
  };

  const callouts = [...build(left, 'left'), ...build(right, 'right')];
  const spread = spreadNumbers(callouts.map((callout) => callout.anchorNarrow));
  return callouts.map((callout, index) => ({ ...callout, anchorNarrow: spread[index] }));
}

// ── Die Maßlinien ────────────────────────────────────────────────────────────

export interface WearDimension {
  partName: string;
  km: number;
  weatherKm: number;
  /** Länge der Wetter-Linie relativ zur Tacho-Linie, nach oben begrenzt. */
  stretch: number;
}

/** Bis hierhin läuft die zweite Maßlinie, danach stieße sie an den Rand der Zeichnung. */
const MAX_STRETCH = 1.4;

/**
 * Tacho gegen Wetter an dem Teil, bei dem der Abstand am größten ist. Bewusst zwei Zahlen
 * desselben Teils: die Gesamtleistung des Rads gegen die eines Teils zu stellen wäre falsch,
 * sobald das Teil einmal getauscht wurde.
 */
export function largestWeatherGap(assemblies: BikeAssembly[]): WearDimension | null {
  let best: WearDimension | null = null;
  let bestSurplus = 0;
  for (const assembly of assemblies) {
    for (const slot of assembly.slots) {
      const part = slot.mounted_component;
      if (!part) continue;
      const surplus = weatherSurplusKm(part);
      if (surplus !== null && surplus > bestSurplus) {
        bestSurplus = surplus;
        best = {
          partName: slot.display_name,
          km: part.wear_km,
          weatherKm: part.weather_wear_km!,
          stretch: Math.min(part.weather_wear_km! / part.wear_km, MAX_STRETCH),
        };
      }
    }
  }
  return best;
}

/** Achsabstand der Illustration: die Tacho-Linie reicht genau von Nabe zu Nabe. */
export const HUB_SPAN = {
  rear: REAR_HUB.x,
  front: FRONT_HUB.x,
  length: FRONT_HUB.x - REAR_HUB.x,
};
