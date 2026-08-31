/**
 * Windabschnitte einer Fahrt, wie sie das Backend liefert
 * (`app_dashboard/api/wind.py::segments_to_geojson`).
 *
 * Ein Feature je Streckenabschnitt gleicher Distanz, mit dem Gegenwind, der sich
 * aus dem *tatsächlichen* Kurs dieses Abschnitts und dem dort herrschenden Wind
 * ergibt. Die Karte rendert diese Collection direkt — sie interpoliert selbst
 * nichts mehr, sonst laufen Karte, Chart und Kopfzeile wieder auseinander.
 */

/** `stream` = abschnittsgenau aus dem GPS-Stream. `coarse` = Start-Ziel-Schätzung. */
export type WindSource = 'stream' | 'coarse';

export interface WindSegmentProperties {
  index: number;
  /** Positiv = Gegenwind, negativ = Rückenwind, in km/h. */
  headwind: number | null;
  wind_speed: number | null;
  /** Meteorologisch: Richtung, aus der der Wind kommt (0 = Nord). */
  wind_direction: number | null;
  /** Fahrtrichtung dieses Abschnitts in Grad (0 = Nord). */
  bearing: number | null;
  precipitation: number | null;
  temperature: number | null;
  distance_km: number;
}

export interface WindSegmentFeature {
  type: 'Feature';
  properties: WindSegmentProperties;
  geometry: { type: 'LineString'; coordinates: [number, number][] };
}

export interface WindSegmentCollection {
  type: 'FeatureCollection';
  wind_source: WindSource;
  features: WindSegmentFeature[];
}
