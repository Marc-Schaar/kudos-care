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
          // Grün = Rückenwind, Grau = neutral, Rot = Gegenwind
          'line-color': [
            'interpolate',
            ['linear'],
            ['get', 'wind_force'],
            -10,
            '#22c55e', // starker Rückenwind
            0,
            '#94a3b8', // kein Wind
            10,
            '#ef4444', // starker Gegenwind
          ],
        },
      });
    }

    this.fitBoundsToRoute(data);
  }

  /**
   * Teilt die Route in Einzelsegmente auf und interpoliert den Gegenwindwert
   * aus dem stündlichen Array auf die Position des Segments entlang der Route.
   *
   * Beispiel: 49 Segmente, 3 Stundenwerte → Segment 0–16 bekommt Wert 0,
   * Segment 17–32 bekommt interpolierten Wert zwischen 0 und 1, usw.
   */
  private buildSegmentedGeoJson(data: any): FeatureCollection {
    const features: any[] = [];

    for (const feature of data.features) {
      const coords: [number, number][] = feature.geometry.coordinates;
      const headwindValues: number[] = feature.properties?.weather_data?.headwind ?? [];
      const totalSegments = coords.length - 1;
      const totalHours = headwindValues.length;

      for (let i = 0; i < totalSegments; i++) {
        // Position entlang der Route als Anteil [0, 1]
        const progress = totalSegments > 1 ? i / (totalSegments - 1) : 0;

        // Auf den stündlichen Index mappen und interpolieren
        const windForce = this.interpolateWindForce(headwindValues, totalHours, progress);

        features.push({
          type: 'Feature',
          properties: { wind_force: windForce },
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
  private interpolateWindForce(values: number[], totalHours: number, progress: number): number {
    if (!values.length) return 0;
    if (totalHours === 1) return values[0];

    const scaled = progress * (totalHours - 1);
    const lowerIdx = Math.floor(scaled);
    const upperIdx = Math.min(lowerIdx + 1, totalHours - 1);
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
