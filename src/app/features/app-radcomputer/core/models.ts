export type Theme = 'night' | 'day';
export type AudioMode = 'off' | 'beep' | 'speech';
export type RoutingProvider = 'brouter' | 'osrm';
export type RoutingProfile = 'trekking' | 'fastbike';
/** Kartenbild: OSM-Standard, CyclOSM (Radwege, Belag) oder OpenTopoMap (Höhenlinien). */
export type MapStyle = 'osm' | 'cyclosm' | 'topo';

/** Eine frei belegte Datenseite: Name und Feldschlüssel aus `ride/fields.ts`. */
export interface DataPageConfig {
  name: string;
  fields: string[];
}

export interface Settings {
  theme: Theme;
  autoPause: boolean;
  /** Geschwindigkeit in km/h, unter der die Auto-Pause greift. `null`, solange das Feld leer ist. */
  autoPauseKmh: number | null;
  autoPauseInWorkout: boolean;
  ftp: number | null;
  audio: AudioMode;
  powerAlerts: boolean;
  lapAnnouncements: boolean;
  mapTiles: boolean;
  headingUp: boolean;
  routingProvider: RoutingProvider;
  routingProfile: RoutingProfile;
  /** Leiste mit GPS, Powermeter, Puls und Uhrzeit oben */
  showStatusBar: boolean;
  /** Bedienleiste unten auf der Fahrt; ausgeblendet erscheint sie nach einem Tipp */
  showControls: boolean;
  /** Klingel in der Bedienleiste */
  bellButton: boolean;
  mapStyle: MapStyle;
  /** Eigene Datenseiten; leer = Standardbelegung (`DEFAULT_PAGES` in `ride/fields.ts`) */
  dataPages: DataPageConfig[];
}

export type RideStatus = 'idle' | 'running' | 'paused';
export type RideDisplayState = RideStatus | 'auto';
export type SensorState = 'off' | 'busy' | 'on' | 'err';

export interface GpsFix {
  lat: number;
  lon: number;
  alt: number | null;
  /** Genauigkeit in Metern */
  acc: number | null;
  altAcc: number | null;
  /** m/s, sofern das Gerät sie liefert */
  speed: number | null;
  /** Kurs in Grad, 0 = Norden */
  heading: number | null;
  t: number;
}

/** Ein Aufzeichnungspunkt je Sekunde: [t, lat, lon, alt, dist, hr, cad, pwr] */
export type TrackPoint = [
  number,
  number | null,
  number | null,
  number | null,
  number,
  number | null,
  number | null,
  number | null,
];

export interface Lap {
  /** Index des ersten Trackpunkts dieser Runde */
  trackIdx: number;
  /** Fahrzeit (ms) und Distanz (m) beim Rundenstart */
  t0: number;
  d0: number;
  pwrSum: number;
  pwrN: number;
  label: string | null;
}

export interface RideStats {
  startedAt: number | null;
  movingMs: number;
  distanceM: number;
  ascentM: number;
  pwrSum: number;
  pwrN: number;
  pwrMax: number;
}

export interface Place {
  name: string;
  lat: number;
  lon: number;
}
