/**
 * Rennrad in Antriebsseiten-Ansicht, Maße in Millimetern (typischer 54er-Rahmen, 700c).
 * viewBox 0 0 1730 960, Fahrbahn bei y = 940. Das Rad fährt nach rechts, deshalb liegt die
 * Kette hinten links und der Tacho vorn am Lenker: daran hängt die Aufteilung der Seite.
 */

export const VIEW_W = 1730;
export const VIEW_H = 960;
export const GROUND_Y = 940;

export const REAR = { x: 370, y: 600 };
export const FRONT = { x: 1360, y: 600 };
export const BB = { x: 769, y: 670 };
export const RING_R = 100;
export const COG_R = 34;
export const UPPER_PULLEY = { x: 388, y: 678, r: 20 };
export const LOWER_PULLEY = { x: 430, y: 764, r: 20 };
export const CRANK_LENGTH = 172;

/** Übersetzung 50/15: die Kurbel dreht sich 3,33-mal langsamer als das Hinterrad. */
export const GEAR_RATIO = 50 / 15;

export interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const round = (value: number): number => Math.round(value * 10) / 10;

/** Gekreuzte Speichen, abwechselnd vor- und nachlaufend, relativ zur Radachse. */
export function spokes(cx: number, cy: number, count: number, lead: number): Line[] {
  const hub = 24;
  const rim = 289;
  return Array.from({ length: count }, (_, i) => {
    const rimAngle = (i * 2 * Math.PI) / count;
    const hubAngle = rimAngle + (i % 2 === 0 ? lead : -lead);
    return {
      x1: round(cx + hub * Math.cos(hubAngle)),
      y1: round(cy + hub * Math.sin(hubAngle)),
      x2: round(cx + rim * Math.cos(rimAngle)),
      y2: round(cy + rim * Math.sin(rimAngle)),
    };
  });
}

/** Rohr als Umriss: Anfang, Ende, Durchmesser an beiden Enden. */
function tube(x1: number, y1: number, x2: number, y2: number, w1: number, w2 = w1): string {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const nx = -(y2 - y1) / length;
  const ny = (x2 - x1) / length;
  const a1 = w1 / 2;
  const a2 = w2 / 2;
  return (
    `M${round(x1 + nx * a1)} ${round(y1 + ny * a1)}` +
    `L${round(x2 + nx * a2)} ${round(y2 + ny * a2)}` +
    `L${round(x2 - nx * a2)} ${round(y2 - ny * a2)}` +
    `L${round(x1 - nx * a1)} ${round(y1 - ny * a1)}Z`
  );
}

/** Hinten nach vorn gezeichnet: was später kommt, verdeckt, was davor kommt. */
export const FRAME_TUBES: readonly string[] = [
  tube(370, 600, 636, 225, 12, 18), // Sattelstrebe
  tube(370, 600, 769, 670, 16, 24), // Kettenstrebe
  tube(769, 670, 627, 190, 36), // Sitzrohr
  tube(632, 208, 1160, 130, 34, 40), // Oberrohr
  tube(769, 670, 1192, 236, 50, 46), // Unterrohr
  tube(1154, 106, 1198, 256, 52), // Steuerrohr
  tube(627, 190, 590, 62, 28), // Sattelstütze
];

export const FORK =
  'M1178 262 L1224 250 C1268 360 1312 480 1370 596 L1350 604 C1286 490 1222 372 1178 262 Z';

export const SADDLE =
  'M468 44 C520 26 590 30 640 38 L738 50 C752 54 750 66 734 66 L640 68 C600 74 540 76 490 68 C462 64 456 52 468 44 Z';

export const STEM = 'M1136 84 L1152 58 L1262 42 L1268 72 L1160 92 Z';

export const BAR =
  'M1252 58 L1322 54 C1380 52 1392 92 1384 128 C1376 170 1344 194 1296 194 L1272 194';

export const HOOD = 'M1318 54 C1336 22 1376 20 1384 44 C1388 62 1382 96 1378 126';

/** Kettenlauf als geschlossene Linie, Radien passend zu Kettenblatt, Ritzel und Röllchen. */
export const CHAIN_PATH =
  `M${BB.x} ${BB.y - RING_R} L${REAR.x} ${REAR.y - COG_R} ` +
  `A${COG_R} ${COG_R} 0 0 0 345 623 ` +
  `L372 666 A${UPPER_PULLEY.r} ${UPPER_PULLEY.r} 0 0 1 404 690 ` +
  `L411 757 A${LOWER_PULLEY.r} ${LOWER_PULLEY.r} 0 0 0 439 782 ` +
  `L${BB.x} ${BB.y + RING_R} A${RING_R} ${RING_R} 0 0 0 ${BB.x} ${BB.y - RING_R}Z`;

/** Kettenteilung 12,7 mm: darauf stehen Laschen und Rollen. */
export const CHAIN_PITCH = 12.7;

/**
 * Höhenlinien für die ferne Ebene, nahtlos über die Kachelbreite: nur ganzzahlige Perioden,
 * damit das Ende exakt an den Anfang passt.
 */
export function ridge(width: number, base: number, amp: number, phase: number): string {
  const step = 24;
  let d = '';
  for (let x = 0; x <= width; x += step) {
    const t = (x / width) * 2 * Math.PI;
    const y =
      base +
      amp *
        (Math.sin(2 * t + phase) +
          0.52 * Math.sin(5 * t + phase * 1.7) +
          0.22 * Math.sin(11 * t + phase * 0.6));
    d += `${x === 0 ? 'M' : 'L'}${x} ${round(y)}`;
  }
  return d;
}
