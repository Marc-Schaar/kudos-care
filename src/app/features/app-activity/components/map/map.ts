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
        // Karte noch nicht bereit — zwischenspeichern
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
    if (!data || data.type !== 'FeatureCollection') {
      console.warn('GeoJSON ungültig oder noch nicht geladen:', data);
      return;
    }

    const source = this.map.getSource('route') as maplibregl.GeoJSONSource | undefined;

    if (source) {
      source.setData(data);
    } else {
      this.map.addSource('route', { type: 'geojson', data });
      this.map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#d32f2f', 'line-width': 4 },
      });
    }

    this.fitBoundsToRoute(data);
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
