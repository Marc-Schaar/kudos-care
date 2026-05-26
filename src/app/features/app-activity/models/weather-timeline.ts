export interface WeatherTimeline {
  time: string[];
  temperature_2m: number[];
  wind_speed_10m: number[];
  precipitation: number[];
  headwind: number[];
  avg_headwind: number;
}
