import { WeatherData } from './weather-data';

export interface ActivityFeature {
  type: string;
  id: number;
  properties: {
    name: string;
    weather_data: WeatherData;
    distance: number;
  };
  geometry: {
    type: string;
    coordinates: [number, number][];
  };
}
