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
import { WindSegmentCollection, WindSegmentProperties } from '../../models/wind-segments';

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

  private map!: maplibregl.Map;
  private pendingData: WindSegmentCollection | null = null;
  private popup: maplibregl.Popup | null = null;

  /**
   * Farben aus den globalen Design-Tokens statt hartkodiert, damit Karte und
   * Charts dieselbe Ampel sprechen.
   */
  private readonly colors = {
    ok: this.cssVar('--ok', '#4ade80'),
    critical: this.cssVar('--critical', '#f43f5e'),
    muted: this.cssVar('--muted', '#8a8e9d'),
    rain: this.cssVar('--rain', '#38bdf8'),
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
      if (this.map?.getLayer('route-line')) {
        this.map.setPaintProperty('route-line', 'line-color', expression);
      }
    });
  }

  private cssVar(name: string, fallback: string): string {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  ngAfterViewInit(): void {
    this.map = new maplibregl.Map({
      container: this.mapContainer.nativeElement,
      style: 'https://tiles.openfreemap.org/styles/liberty',
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
    this.popup?.remove();
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
      this.registerSegmentPopup();
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

  /** Klick auf einen Abschnitt zeigt dessen konkrete Zahlen statt nur einer Farbe. */
  private registerSegmentPopup(): void {
    this.map.on('click', 'route-line', (event) => {
      const feature = event.features?.[0];
      if (!feature) return;

      const props = feature.properties as unknown as WindSegmentProperties;
      this.popup?.remove();
      this.popup = new maplibregl.Popup({ closeButton: true, maxWidth: '260px' })
        .setLngLat(event.lngLat)
        .setHTML(this.popupHtml(props))
        .addTo(this.map);
    });

    this.map.on('mouseenter', 'route-line', () => {
      this.map.getCanvas().style.cursor = 'pointer';
    });
    this.map.on('mouseleave', 'route-line', () => {
      this.map.getCanvas().style.cursor = '';
    });
  }

  private popupHtml(props: WindSegmentProperties): string {
    const headwind = props.headwind;
    const label = headwind == null ? 'Wind' : headwind > 0 ? 'Gegenwind' : 'Rückenwind';
    const value = headwind == null ? '–' : `${Math.abs(headwind).toFixed(1)} km/h`;

    const rows = [
      `<strong>${label}: ${value}</strong>`,
      props.wind_direction != null
        ? `Wind aus ${this.compass(props.wind_direction)} (${Math.round(props.wind_direction)}°)`
        : null,
      props.bearing != null ? `Fahrtrichtung ${this.compass(props.bearing)}` : null,
      props.precipitation ? `Niederschlag ${props.precipitation.toFixed(1)} mm/h` : null,
    ].filter(Boolean);

    // Inline-Styles statt Komponenten-CSS: MapLibre hängt das Popup-Markup selbst in
    // den DOM, ohne Angulars Encapsulation-Attribut — Komponentenstile griffen nicht.
    return (
      `<div style="font-family:'DM Mono',monospace;font-size:0.72rem;line-height:1.5;">` +
      `${rows.join('<br>')}</div>`
    );
  }

  private compass(degrees: number): string {
    const points = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
    return points[Math.round(((degrees % 360) / 45)) % 8];
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
