import { WeatherTimeline } from './weather-timeline';

export interface ActivityDetailModel {
  name: string;
  geo_json_full: any;
  weather_timeline: WeatherTimeline;
}
