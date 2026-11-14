import { Place } from '../core/models';

export interface RoutePoint {
  lat: number;
  lon: number;
  /** Strecke ab Routenbeginn in Metern */
  dist: number;
}

export type CueKind =
  | 'left'
  | 'right'
  | 'slight-left'
  | 'slight-right'
  | 'sharp-left'
  | 'sharp-right'
  | 'uturn'
  | 'straight'
  | 'roundabout'
  | 'arrive';

export interface Cue {
  /** Index des Routenpunkts, an dem der Hinweis gilt */
  index: number;
  dist: number;
  kind: CueKind;
  text: string;
}

/** Hinweis mit Koordinate, bevor er einem Routenpunkt zugeordnet ist. */
export interface RawCue {
  lat: number;
  lon: number;
  kind: CueKind;
  text: string;
}

export interface NavRoute {
  name: string;
  points: RoutePoint[];
  cues: Cue[];
  lengthM: number;
  /** Gesetzt bei Zielführung: dorthin wird bei Abweichung neu geroutet. */
  destination: Place | null;
}

export interface NavProgress {
  /** Index des Routenabschnitts, auf dem wir gerade sind */
  index: number;
  alongM: number;
  /** Abstand zur Route */
  offM: number;
  remainingM: number;
  nextCue: Cue | null;
  cueDistM: number | null;
  offRoute: boolean;
  arrived: boolean;
}

export const CUE_TEXT: Record<CueKind, string> = {
  left: 'Links abbiegen',
  right: 'Rechts abbiegen',
  'slight-left': 'Leicht links halten',
  'slight-right': 'Leicht rechts halten',
  'sharp-left': 'Scharf links abbiegen',
  'sharp-right': 'Scharf rechts abbiegen',
  uturn: 'Wenden',
  straight: 'Geradeaus weiter',
  roundabout: 'In den Kreisverkehr einfahren',
  arrive: 'Ziel erreicht',
};
