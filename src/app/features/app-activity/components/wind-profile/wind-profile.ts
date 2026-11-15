import { Component, computed, input, model } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { WindSegmentCollection } from '../../models/wind-segments';
import {
  idleSentence,
  ProfileMode,
  ProfileSegment,
  profileSegments,
  profileValue,
  RAIN_SCALE_FLOOR_MM,
  rulerTicks,
  segmentAtKm,
  segmentSentence,
} from '../../models/wind-profile';

interface Bar {
  index: number;
  x: number;
  width: number;
  y: number;
  height: number;
  fill: string;
}

/**
 * Das Windprofil unter der Karte: die Fahrt über die Distanz abgerollt. Oberhalb der
 * Nulllinie Gegenwind, darunter Rückenwind, im Regen-Modus Niederschlag von unten.
 *
 * `active` ist dieselbe Abschnitts-Nummer wie in der Karte (`properties.index`) und wird
 * in beide Richtungen gebunden: Zeigen auf einen Balken hebt die Stelle auf der Karte
 * hervor und umgekehrt. Der Satz darüber ersetzt das frühere Karten-Popup, damit es nur
 * einen Ort für die Zahlen eines Abschnitts gibt.
 *
 * Die Farbskala ist relativ zum stärksten Wert dieser Fahrt, wie die Karte.
 */
@Component({
  selector: 'app-wind-profile',
  imports: [DecimalPipe],
  templateUrl: './wind-profile.html',
  styleUrl: './wind-profile.css',
})
export class WindProfile {
  segments = input<WindSegmentCollection | null>(null);
  mode = input<ProfileMode>('wind');
  /** Distanz laut Strava, auf die die Achse gestreckt wird (siehe `profileSegments`). */
  rideKm = input<number | null>(null);
  active = model<number | null>(null);

  /** Breite der Zeichenfläche in viewBox-Einheiten. Die Höhe ist 100. */
  private readonly width = 1000;

  readonly rows = computed(() => profileSegments(this.segments(), this.rideKm()));
  readonly totalKm = computed(() => this.rows().at(-1)?.endKm ?? 0);

  readonly scaleMax = computed(() =>
    this.rows().reduce(
      (max, row) => Math.max(max, Math.abs(profileValue(row, this.mode()) ?? 0)),
      this.mode() === 'rain' ? RAIN_SCALE_FLOOR_MM : 0,
    ),
  );

  readonly bars = computed<Bar[]>(() => {
    const total = this.totalKm();
    const max = this.scaleMax();
    if (total <= 0) return [];
    const rain = this.mode() === 'rain';
    // Wind teilt die Höhe in zwei Hälften um die Nulllinie, Regen wächst vom Boden.
    const baseline = rain ? 100 : 50;
    const reach = rain ? 92 : 46;
    const gap = this.rows().length > 120 ? 0 : 1.5;

    return this.rows().map((row) => {
      const value = profileValue(row, this.mode());
      const intensity = value == null || max <= 0 ? 0 : Math.min(1, Math.abs(value) / max);
      // Auch ein windstiller Abschnitt bleibt als Strich auf der Linie sichtbar.
      const height = Math.max(1.2, intensity * reach);
      const up = rain || (value ?? 0) >= 0;
      const x = (row.startKm / total) * this.width;
      return {
        index: row.index,
        x: x + gap / 2,
        width: Math.max(0.5, ((row.endKm - row.startKm) / total) * this.width - gap),
        y: up ? baseline - height : baseline,
        height,
        fill: this.fill(value, intensity),
      };
    });
  });

  readonly ticks = computed(() =>
    rulerTicks(this.totalKm())
      .map((km) => ({ km, x: (km / this.totalKm()) * 100 }))
      // Platz für die Gesamtlänge am Ende des Lineals.
      .filter((tick) => tick.x <= 86),
  );

  readonly activeRow = computed<ProfileSegment | null>(() => {
    const index = this.active();
    return index == null ? null : (this.rows().find((row) => row.index === index) ?? null);
  });

  readonly cursorX = computed(() => {
    const row = this.activeRow();
    const total = this.totalKm();
    if (!row || total <= 0) return null;
    return ((row.startKm + row.endKm) / 2 / total) * 100;
  });

  readonly sentence = computed(() => {
    const row = this.activeRow();
    return row ? segmentSentence(row, this.mode()) : idleSentence(this.rows(), this.mode());
  });

  readonly unit = computed(() => (this.mode() === 'rain' ? 'mm/h' : 'km/h'));

  private fill(value: number | null, intensity: number): string {
    if (value == null) return 'var(--border)';
    const base =
      this.mode() === 'rain' ? 'var(--rain)' : value >= 0 ? 'var(--critical)' : 'var(--ok)';
    return `color-mix(in srgb, ${base} ${Math.round(25 + intensity * 75)}%, var(--muted))`;
  }

  onPointer(event: PointerEvent, plot: HTMLElement): void {
    const rect = plot.getBoundingClientRect();
    if (rect.width <= 0) return;
    const fraction = (event.clientX - rect.left) / rect.width;
    const row = segmentAtKm(this.rows(), fraction * this.totalKm());
    if (row && row.index !== this.active()) this.active.set(row.index);
  }

  onLeave(event: PointerEvent): void {
    // Am Touchscreen bleibt der angetippte Abschnitt stehen, sonst verschwände er beim Loslassen.
    if (event.pointerType === 'mouse') this.active.set(null);
  }

  onKey(event: KeyboardEvent): void {
    const rows = this.rows();
    if (!rows.length) return;
    const current = rows.findIndex((row) => row.index === this.active());
    let next: number | null;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = current < 0 ? 0 : Math.min(rows.length - 1, current + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = current < 0 ? rows.length - 1 : Math.max(0, current - 1);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = rows.length - 1;
        break;
      case 'Escape':
        this.active.set(null);
        return;
      default:
        return;
    }
    event.preventDefault();
    this.active.set(rows[next].index);
  }
}
