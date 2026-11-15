import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  effect,
  input,
  model,
} from '@angular/core';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { WindSegmentCollection } from '../../models/wind-segments';

/**
 * Streckenkarte mit abschnittsweiser Einfärbung nach Gegenwind bzw. Niederschlag.
 *
 * Die Abschnitte kommen fertig berechnet vom Backend (`wind_segments`). Früher
 * schnitt diese Komponente den vereinfachten Track selbst in Segmente und
 * interpolierte die Stundenwerte über den Segment-Index — das war grundsätzlich
 * falsch, weil der RDP-vereinfachte Track in Kurven viele und auf Geraden wenige
 * Punkte enthält, Index-Fortschritt also nicht Zeit-Fortschritt entspricht.
 *
 * Die Farbskala ist relativ zum stärksten Wert dieser Fahrt — identisch zu den
 * Charts daneben, und damit endlich passend zur Legende.
 */
@Component({
  selector: 'app-map',
  imports: [],
  templateUrl: './map.html',
  styleUrl: './map.css',
})
export class Map implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef;

  segments = input<WindSegmentCollection | null>(null);
  mode = input<'wind' | 'rain'>('wind');
  /** Stärkster |Gegenwind| dieser Fahrt — Bezugsgröße der relativen Farbskala. */
  maxAbsHeadwind = input<number>(0);
  /** Stärkster Niederschlag dieser Fahrt. */
  maxPrecipitation = input<number>(0);
  /**
   * Hervorgehobener Abschnitt (`properties.index`), geteilt mit dem Windprofil. Die Zahlen
   * dazu stehen im Satz über dem Profil, nicht in einem Popup auf der Karte.
   */
  active = model<number | null>(null);

  private map!: maplibregl.Map;
  private pendingData: WindSegmentCollection | null = null;

  /**
   * Farben aus den globalen Design-Tokens statt hartkodiert, damit Karte und
   * Charts dieselbe Ampel sprechen.
   */
  private readonly colors = {
    ok: this.cssVar('--ok', '#4ade80'),
    critical: this.cssVar('--critical', '#f43f5e'),
    muted: this.cssVar('--muted', '#8a8e9d'),
    rain: this.cssVar('--rain', '#38bdf8'),
    text: this.cssVar('--text', '#e8e9ec'),
  };

  constructor() {
    effect(() => {
      const data = this.segments();
      if (!data) return;

      if (this.map?.isStyleLoaded()) {
        this.applySegments(data);
      } else {
        this.pendingData = data;
      }
    });

    effect(() => {
      // Auf mode + beide Maxima reagieren, damit die Skala mitzieht.
      const expression = this.lineColorExpression(
        this.mode(),
        this.maxAbsHeadwind(),
        this.maxPrecipitation(),
      );
      for (const layer of ['route-line', 'route-active']) {
        if (this.map?.getLayer(layer)) this.map.setPaintProperty(layer, 'line-color', expression);
      }
    });

    effect(() => {
      const index = this.active();
      const filter = this.activeFilter(index);
      for (const layer of ['route-active-casing', 'route-active']) {
        if (this.map?.getLayer(layer)) this.map.setFilter(layer, filter);
      }
      const ring = this.map?.getSource('route-active-ring') as maplibregl.GeoJSONSource | undefined;
      ring?.setData(this.ringData(index));
    });
  }

  /**
   * Ein Ring um die Mitte des aktiven Abschnitts. Abschnitte aus dem GPS-Stream sind oft nur
   * ein paar Dutzend Meter lang: ohne Ring fände man die hervorgehobene Stelle nicht.
   */
  private ringData(index: number | null): GeoJSON.FeatureCollection {
    const feature = this.segments()?.features.find((f) => f.properties.index === index);
    const coords = feature?.geometry.coordinates ?? [];
    if (index == null || !coords.length) return { type: 'FeatureCollection', features: [] };
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Point', coordinates: coords[Math.floor(coords.length / 2)] },
        },
      ],
    };
  }

  /** Ohne aktiven Abschnitt passt der Filter auf nichts, die Ebenen bleiben leer. */
  private activeFilter(index: number | null): maplibregl.FilterSpecification {
    return ['==', ['get', 'index'], index ?? -1];
  }

  private cssVar(name: string, fallback: string): string {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  ngAfterViewInit(): void {
    this.map = new maplibregl.Map({
      container: this.mapContainer.nativeElement,
      // Die bunte Standardkarte erschlägt die Einfärbung der Strecke, um die es hier geht.
      style: `https://tiles.openfreemap.org/styles/${
        matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'positron'
      }`,
      center: [7.0, 51.0],
      zoom: 10,
    });

    this.map.on('load', () => {
      const data = this.pendingData ?? this.segments();
      if (data) {
        this.applySegments(data);
        this.pendingData = null;
      }
    });
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private applySegments(data: WindSegmentCollection): void {
    if (!data.features?.length) return;

    const source = this.map.getSource('route') as maplibregl.GeoJSONSource | undefined;

    if (source) {
      source.setData(data as unknown as GeoJSON.FeatureCollection);
    } else {
      this.map.addSource('route', {
        type: 'geojson',
        data: data as unknown as GeoJSON.FeatureCollection,
      });
      this.map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-width': 4,
          'line-color': this.lineColorExpression(
            this.mode(),
            this.maxAbsHeadwind(),
            this.maxPrecipitation(),
          ),
        },
      });
      // Der aktive Abschnitt liegt über der Strecke: ein heller Rand, darin seine eigene Farbe.
      this.map.addLayer({
        id: 'route-active-casing',
        type: 'line',
        source: 'route',
        filter: this.activeFilter(this.active()),
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-width': 11, 'line-color': this.colors.text },
      });
      this.map.addLayer({
        id: 'route-active',
        type: 'line',
        source: 'route',
        filter: this.activeFilter(this.active()),
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-width': 6,
          'line-color': this.lineColorExpression(
            this.mode(),
            this.maxAbsHeadwind(),
            this.maxPrecipitation(),
          ),
        },
      });
      this.map.addSource('route-active-ring', {
        type: 'geojson',
        data: this.ringData(this.active()),
      });
      this.map.addLayer({
        id: 'route-active-ring',
        type: 'circle',
        source: 'route-active-ring',
        paint: {
          'circle-radius': 13,
          'circle-color': 'rgba(0, 0, 0, 0)',
          'circle-stroke-width': 2,
          'circle-stroke-color': this.colors.text,
        },
      });
      // Unsichtbar und breit: die Trefferfläche für Finger, die 4-px-Linie trifft man nicht.
      this.map.addLayer({
        id: 'route-hit',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-width': 24, 'line-opacity': 0 },
      });
      this.registerSegmentPointer();
    }

    this.fitBoundsToSegments(data);
  }

  /** Grün = Rückenwind, Grau = neutral, Rot = Gegenwind — relativ zum Maximum der Fahrt. */
  private windLineColorExpression(maxAbs: number): maplibregl.ExpressionSpecification {
    // Ohne Wind gäbe es keine Spanne zum Interpolieren; 1 km/h hält die Skala gültig.
    const span = maxAbs > 0 ? maxAbs : 1;
    return [
      'interpolate',
      ['linear'],
      ['coalesce', ['get', 'headwind'], 0],
      -span,
      this.colors.ok,
      0,
      this.colors.muted,
      span,
      this.colors.critical,
    ];
  }

  /** Grau = kein Regen, Blau = stärkster Regen dieser Fahrt. */
  private rainLineColorExpression(max: number): maplibregl.ExpressionSpecification {
    const span = max > 0 ? max : 1;
    return [
      'interpolate',
      ['linear'],
      ['coalesce', ['get', 'precipitation'], 0],
      0,
      this.colors.muted,
      span,
      this.colors.rain,
    ];
  }

  private lineColorExpression(
    mode: 'wind' | 'rain',
    maxAbsHeadwind: number,
    maxPrecipitation: number,
  ): maplibregl.ExpressionSpecification {
    return mode === 'rain'
      ? this.rainLineColorExpression(maxPrecipitation)
      : this.windLineColorExpression(maxAbsHeadwind);
  }

  /**
   * Zeigen auf die Strecke wählt den Abschnitt, Tippen ebenso (am Touchscreen gibt es kein
   * Zeigen). Tippen daneben hebt die Auswahl wieder auf.
   */
  private registerSegmentPointer(): void {
    const pick = (event: maplibregl.MapLayerMouseEvent) => {
      const index = event.features?.[0]?.properties?.['index'];
      if (typeof index === 'number' && index !== this.active()) this.active.set(index);
    };
    this.map.on('mousemove', 'route-hit', pick);
    this.map.on('click', 'route-hit', pick);

    this.map.on('mouseenter', 'route-hit', () => {
      this.map.getCanvas().style.cursor = 'pointer';
    });
    this.map.on('mouseleave', 'route-hit', () => {
      this.map.getCanvas().style.cursor = '';
      this.active.set(null);
    });
    this.map.on('click', (event) => {
      const hit = this.map.queryRenderedFeatures(event.point, { layers: ['route-hit'] });
      if (!hit.length) this.active.set(null);
    });
  }

  private fitBoundsToSegments(data: WindSegmentCollection): void {
    const coords = data.features.flatMap((f) => f.geometry.coordinates);
    if (!coords.length) return;

    const bounds = coords.reduce(
      (acc, coord) => acc.extend(coord),
      new maplibregl.LngLatBounds(coords[0], coords[0]),
    );

    this.map.fitBounds(bounds, { padding: 50, duration: 500 });
  }
}
