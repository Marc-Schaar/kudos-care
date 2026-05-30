import { ActivityFeature } from './activity-feature';
import { WeatherTimeline } from './weather-timeline';

export interface ActivityDetailModel {
  name: string;
  geo_json_full: { type: string; features: ActivityFeature[] };
  weather_timeline: WeatherTimeline;
}
