import { ActivityFeature } from './activity-feature';
import { WeatherTimeline } from './weather-timeline';
import { WindSegmentCollection } from './wind-segments';

export interface ActivityDetailModel {
  name: string;
  distance_km: number | null;
  elapsed_time: number | null;
  start_date: string | null;
  bike_name: string | null;
  geo_json_full: { type: string; features: ActivityFeature[] };
  weather_timeline: Partial<WeatherTimeline>;
  /**
   * Abschnittsweiser Gegenwind/Niederschlag für die Karte. Wird vom Backend aus
   * dem GPS-Stream berechnet — dieselbe Quelle wie `weather_timeline.avg_headwind`.
   */
  wind_segments: WindSegmentCollection;
}
