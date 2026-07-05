import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  effect,
  input,
} from '@angular/core';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { FeatureCollection } from 'geojson';

@Component({
  selector: 'app-map',
  imports: [],
  templateUrl: './map.html',
  styleUrl: './map.css',
})
export class Map implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef;
  routeGeoJson = input<any>();
  mode = input<'wind' | 'rain'>('wind');

  private map!: maplibregl.Map;
  private pendingData: any = null;

  constructor() {
    effect(() => {
      const data = this.routeGeoJson();
      if (!data) return;

      if (this.map?.isStyleLoaded()) {
        this.applyRouteData(data);
      } else {
        this.pendingData = data;
      }
    });

    effect(() => {
      const mode = this.mode();
      if (this.map?.getLayer('route-line')) {
        this.map.setPaintProperty('route-line', 'line-color', this.lineColorExpression(mode));
      }
    });
  }

  ngAfterViewInit(): void {
    this.map = new maplibregl.Map({
      container: this.mapContainer.nativeElement,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [7.0, 51.0],
      zoom: 10,
    });

    this.map.on('load', () => {
      const data = this.pendingData ?? this.routeGeoJson();
      if (data) {
        this.applyRouteData(data);
        this.pendingData = null;
      }
    });
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private applyRouteData(data: any): void {
    if (!data || data.type !== 'FeatureCollection') return;

    const segmentedData = this.buildSegmentedGeoJson(data);
    const source = this.map.getSource('route') as maplibregl.GeoJSONSource | undefined;

    if (source) {
      source.setData(segmentedData);
    } else {
      this.map.addSource('route', { type: 'geojson', data: segmentedData });
      this.map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-width': 4,
          'line-color': this.lineColorExpression(this.mode()),
        },
      });
    }

    this.fitBoundsToRoute(data);
  }

  /** Grün = Rückenwind, Grau = neutral, Rot = Gegenwind. */
  private windLineColorExpression(): maplibregl.ExpressionSpecification {
    return [
      'interpolate',
      ['linear'],
      ['get', 'wind_force'],
      -10,
      '#22c55e',
      0,
      '#94a3b8',
      10,
      '#ef4444',
    ];
  }

  /** Grau = kein Regen, Blau = starker Regen. */
  private rainLineColorExpression(): maplibregl.ExpressionSpecification {
    return ['interpolate', ['linear'], ['get', 'rain_intensity'], 0, '#94a3b8', 2, '#38bdf8'];
  }

  private lineColorExpression(mode: 'wind' | 'rain'): maplibregl.ExpressionSpecification {
    return mode === 'rain' ? this.rainLineColorExpression() : this.windLineColorExpression();
  }

  /**
   * Teilt die Route in Einzelsegmente auf und interpoliert Gegenwind- und
   * Niederschlagswert aus den stündlichen Arrays auf die Position des
   * Segments entlang der Route.
   *
   * Beispiel: 49 Segmente, 3 Stundenwerte → Segment 0–16 bekommt Wert 0,
   * Segment 17–32 bekommt interpolierten Wert zwischen 0 und 1, usw.
   */
  private buildSegmentedGeoJson(data: any): FeatureCollection {
    const features: any[] = [];

    for (const feature of data.features) {
      const coords: [number, number][] = feature.geometry.coordinates;
      const weatherData = feature.properties?.weather_data ?? {};
      const headwindValues: number[] = weatherData.headwind ?? [];
      const precipitationValues: number[] = weatherData.precipitation ?? [];
      const totalSegments = coords.length - 1;

      for (let i = 0; i < totalSegments; i++) {
        // Position entlang der Route als Anteil [0, 1]
        const progress = totalSegments > 1 ? i / (totalSegments - 1) : 0;

        features.push({
          type: 'Feature',
          properties: {
            wind_force: this.interpolateValue(headwindValues, progress),
            rain_intensity: this.interpolateValue(precipitationValues, progress),
          },
          geometry: {
            type: 'LineString',
            coordinates: [coords[i], coords[i + 1]],
          },
        });
      }
    }

    return { type: 'FeatureCollection', features };
  }

  /**
   * Interpoliert linear zwischen zwei Stundenwerten.
   * progress: 0.0 = Startpunkt, 1.0 = Endpunkt der Route
   */
  private interpolateValue(values: number[], progress: number): number {
    if (!values.length) return 0;
    if (values.length === 1) return values[0];

    const scaled = progress * (values.length - 1);
    const lowerIdx = Math.floor(scaled);
    const upperIdx = Math.min(lowerIdx + 1, values.length - 1);
    const t = scaled - lowerIdx;

    return values[lowerIdx] * (1 - t) + values[upperIdx] * t;
  }

  private fitBoundsToRoute(geojson: any): void {
    try {
      const coords = geojson.features[0].geometry.coordinates;
      if (!coords?.length) return;

      const bounds = coords.reduce(
        (acc: [[number, number], [number, number]], coord: [number, number]) => [
          [Math.min(acc[0][0], coord[0]), Math.min(acc[0][1], coord[1])],
          [Math.max(acc[1][0], coord[0]), Math.max(acc[1][1], coord[1])],
        ],
        [
          [coords[0][0], coords[0][1]],
          [coords[0][0], coords[0][1]],
        ],
      );

      this.map.fitBounds(bounds as [maplibregl.LngLatLike, maplibregl.LngLatLike], {
        padding: 50,
        duration: 500,
      });
    } catch (e) {
      console.error('Konnte Bounds nicht berechnen', e);
    }
  }
}
