import { Weather, WearCategory, rideMultiplier } from './wear-formula';

/**
 * Die Beispielsaison, die beim Scrollen abläuft. Die Fahrten sind erfunden und auf der
 * Seite als Beispiel gekennzeichnet, gerechnet wird mit der echten Formel. Bewusst kein
 * Dauerregen: rund ein Drittel der Kilometer ist nass, dazwischen liegt eine trockene
 * Fahrt, bei der beide Zähler wieder gleich laufen.
 */
export interface SampleRide extends Weather {
  km: number;
}

const dry = (km: number, temperature: number, windSpeed = 12): SampleRide => ({
  km,
  precipitation: 0,
  temperature,
  windSpeed,
});
const wet = (
  km: number,
  precipitation: number,
  temperature: number,
  windSpeed = 14,
): SampleRide => ({
  km,
  precipitation,
  temperature,
  windSpeed,
});

export const SAMPLE_RIDES: readonly SampleRide[] = [
  dry(84, 14),
  dry(62, 17),
  dry(118, 19),
  dry(46, 21),
  dry(96, 18),
  dry(74, 16),
  dry(132, 22),
  dry(58, 20),
  dry(104, 18),
  dry(68, 15),
  dry(92, 19),
  dry(66, 17),
  wet(58, 1.6, 12),
  wet(72, 2.8, 11),
  wet(44, 4.2, 9, 18),
  dry(38, 14),
  wet(86, 3.4, 10, 24),
  wet(64, 5.5, 8, 22),
  wet(52, 2.4, 11),
  wet(70, 3.1, 9),
  wet(56, 4.8, 7, 19),
];

/** Index der ersten Fahrt mit Regen: hier beginnt der Peak. */
export const FIRST_WET_RIDE = SAMPLE_RIDES.findIndex((ride) => ride.precipitation > 0);

/** Lebensdauer aus dem Katalog (`component_templates.json`), Marker = Position in der Zeichnung. */
export interface TrackedPart {
  id: string;
  name: string;
  category: WearCategory;
  warnKm: number;
}

export const TRACKED_PARTS: readonly TrackedPart[] = [
  { id: 'chain', name: 'Kette', category: 'drivetrain', warnKm: 2000 },
  { id: 'cassette', name: 'Kassette', category: 'drivetrain', warnKm: 8000 },
  { id: 'rear-tyre', name: 'Reifen hinten', category: 'wheels', warnKm: 4000 },
  { id: 'pads', name: 'Bremsbeläge', category: 'brakes', warnKm: 3000 },
  { id: 'front-tyre', name: 'Reifen vorne', category: 'wheels', warnKm: 5000 },
];

export interface SeasonPoint {
  /** Gefahrene Kilometer, also das, was der Tacho zeigt. */
  km: number;
  /** Wetter-gewichtete Kilometer je Kategorie. */
  wear: Record<WearCategory, number>;
  /** Index der laufenden Fahrt. */
  ride: number;
}

const CATEGORIES: readonly WearCategory[] = [
  'drivetrain',
  'brakes',
  'wheels',
  'suspension',
  'cockpit',
];

function emptyWear(): Record<WearCategory, number> {
  return { drivetrain: 0, brakes: 0, wheels: 0, suspension: 0, cockpit: 0 };
}

/** Stand der Saison nach `km` gefahrenen Kilometern. Innerhalb einer Fahrt linear. */
export function seasonAt(km: number): SeasonPoint {
  const wear = emptyWear();
  let remaining = Math.max(0, km);
  let ride = 0;

  for (let i = 0; i < SAMPLE_RIDES.length; i++) {
    const current = SAMPLE_RIDES[i];
    const part = Math.min(remaining, current.km);
    for (const category of CATEGORIES) {
      wear[category] += part * rideMultiplier(current, category).multiplier;
    }
    remaining -= part;
    ride = i;
    if (remaining <= 0) break;
  }

  return { km: km - Math.max(0, remaining), wear, ride };
}

export const SEASON_KM = SAMPLE_RIDES.reduce((sum, ride) => sum + ride.km, 0);
export const DRY_KM = SAMPLE_RIDES.slice(0, FIRST_WET_RIDE).reduce((sum, ride) => sum + ride.km, 0);
