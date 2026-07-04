import { ActivityFeature } from './activity-feature';
import { WeatherTimeline } from './weather-timeline';

export interface ActivityDetailModel {
  name: string;
  distance_km: number | null;
  elapsed_time: number | null;
  start_date: string | null;
  bike_name: string | null;
  geo_json_full: { type: string; features: ActivityFeature[] };
  weather_timeline: Partial<WeatherTimeline>;
}
