import { Component, computed, input, linkedSignal, model } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { WearImpactBreakdown, WearImpactCategory } from '../../models/wear-impact';
import { rulerTicks } from '../../models/wind-profile';
import { WindSegmentCollection } from '../../models/wind-segments';
import { densestSpan, TracePoint, traceCategories, wearTrace } from '../../models/wear-trace';

const one = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const two = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const whole = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });

/** Oberkante des Vollausschlags in Prozent der Höhe, wie `.guide.top` im Windprofil. */
const TOP = 4;

/**
 * Wo eine Fahrt das Rad gekostet hat: der Verschleiß einer Kategorie über die Distanz,
 * gegen die gefahrenen Kilometer. Die schraffierte Fläche dazwischen ist der
 * Wetteraufschlag, in derselben Bildsprache wie die Balken der Aufschlüsselung, blau nur
 * bei Regen.
 *
 * `active` ist dieselbe Abschnitts-Nummer wie in Karte und Windprofil: Zeigen auf den
 * Verlauf hebt die Stelle auf der Karte hervor und umgekehrt.
 */
@Component({
  selector: 'app-wear-trace',
  imports: [DecimalPipe],
  templateUrl: './wear-trace.html',
  styleUrl: './wear-trace.css',
})
export class WearTrace {
  segments = input<WindSegmentCollection | null>(null);
  rideKm = input<number | null>(null);
  breakdown = input.required<WearImpactBreakdown>();
  active = model<number | null>(null);

  readonly categories = computed(() => traceCategories(this.breakdown(), this.segments()));

  /** Vorausgewählt die teuerste Kategorie, wie im Satz der Aufschlüsselung. */
  readonly selectedKey = linkedSignal<WearImpactCategory[], string | null>({
    source: this.categories,
    computation: (cats, previous) =>
      cats.find((cat) => cat.category === previous?.value)?.category ?? cats[0]?.category ?? null,
  });

  readonly category = computed(
    () => this.categories().find((cat) => cat.category === this.selectedKey()) ?? null,
  );

  readonly points = computed<TracePoint[]>(() =>
    wearTrace(this.segments(), this.rideKm(), this.category()?.segment_extra_km ?? []),
  );

  readonly totalKm = computed(() => this.points().at(-1)?.endKm ?? 0);
  readonly totalWear = computed(() => this.points().at(-1)?.wearKm ?? 0);
  readonly rain = computed(() => this.category()?.dominant_driver === 'rain');

  private x(km: number): number {
    const total = this.totalKm();
    return total > 0 ? (km / total) * 100 : 0;
  }

  private y(wear: number): number {
    const max = this.totalWear();
    return max > 0 ? 100 - (wear / max) * (100 - TOP) : 100;
  }

  /** Verschleiß-Linie als Punktfolge in Prozent, Anfang bei 0. */
  private readonly line = computed(() => [
    [0, 100] as const,
    ...this.points().map((p) => [this.x(p.endKm), this.y(p.wearKm)] as const),
  ]);

  readonly wearPath = computed(() =>
    this.line()
      .map(([x, y], i) => `${i ? 'L' : 'M'}${(x * 10).toFixed(1)} ${y.toFixed(2)}`)
      .join(' '),
  );

  /** Gefahrene km auf derselben Skala: eine Gerade, an der der Aufschlag hängt. */
  readonly riddenEndY = computed(() => this.y(this.totalKm()));

  /** Die Fläche zwischen beiden Linien als `clip-path` für die schraffierte Ebene. */
  readonly gapClip = computed(() => {
    const upper = this.line().map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`);
    return `polygon(${upper.join(', ')}, 100% ${this.riddenEndY().toFixed(2)}%, 0% 100%)`;
  });

  readonly ticks = computed(() =>
    rulerTicks(this.totalKm())
      .map((km) => ({ km, x: this.x(km) }))
      .filter((tick) => tick.x <= 86),
  );

  readonly activePoint = computed<TracePoint | null>(() => {
    const index = this.active();
    return index == null ? null : (this.points().find((p) => p.index === index) ?? null);
  });

  /** Cursor am Ende des Abschnitts, weil der Satz „bis km …" sagt. */
  readonly cursor = computed(() => {
    const p = this.activePoint();
    return p ? { x: this.x(p.endKm), y: this.y(p.wearKm) } : null;
  });

  readonly sentence = computed(() => {
    const point = this.activePoint();
    const cat = this.category();
    if (!cat) return '';
    return point ? pointSentence(point, cat) : idleSentence(this.points(), cat);
  });

  select(key: string): void {
    this.selectedKey.set(key);
  }

  onPointer(event: PointerEvent, plot: HTMLElement): void {
    const rect = plot.getBoundingClientRect();
    if (rect.width <= 0) return;
    const km = ((event.clientX - rect.left) / rect.width) * this.totalKm();
    const points = this.points();
    const hit = points.find((p) => km >= p.startKm && km < p.endKm) ?? points.at(km < 0 ? 0 : -1);
    if (hit && hit.index !== this.active()) this.active.set(hit.index);
  }

  onLeave(event: PointerEvent): void {
    if (event.pointerType === 'mouse') this.active.set(null);
  }

  onKey(event: KeyboardEvent): void {
    const points = this.points();
    if (!points.length) return;
    const current = points.findIndex((p) => p.index === this.active());
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = current < 0 ? 0 : Math.min(points.length - 1, current + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = current < 0 ? points.length - 1 : Math.max(0, current - 1);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = points.length - 1;
        break;
      case 'Escape':
        this.active.set(null);
        return;
      default:
        return;
    }
    event.preventDefault();
    this.active.set(points[next].index);
  }
}

/** Die Bedingung, die für diese Kategorie den Aufschlag treibt, an dieser Stelle. */
function condition(point: TracePoint, cat: WearImpactCategory): string {
  const p = point.props;
  switch (cat.dominant_driver) {
    case 'rain':
      return p.precipitation ? `, bei ${one.format(p.precipitation)} mm/h Regen` : '';
    case 'wind':
      return p.wind_speed != null ? `, bei ${whole.format(p.wind_speed)} km/h Wind` : '';
    case 'cold':
    case 'heat':
      return p.temperature != null ? `, bei ${whole.format(p.temperature)} °C` : '';
    default:
      return '';
  }
}

export function pointSentence(point: TracePoint, cat: WearImpactCategory): string {
  const head = `Bis km ${one.format(point.endKm)}: ${one.format(point.wearKm)} km verschlissen.`;
  if (point.factor < 1.005) return `${head} Hier kam nichts dazu.`;
  return `${head} Hier zählte jeder Kilometer ${two.format(point.factor)}-fach${condition(point, cat)}.`;
}

export function idleSentence(points: readonly TracePoint[], cat: WearImpactCategory): string {
  const total = points.at(-1)?.endKm ?? 0;
  const span = densestSpan(points);
  if (!span || total <= 0) return '';
  const length = span.endKm - span.startKm;
  // Liegt die Hälfte auf der halben Strecke, gibt es keine Stelle, auf die es ankam.
  if (length >= total * 0.4) {
    return `Der Aufschlag für ${cat.category_display} verteilt sich über die ganze Strecke.`;
  }
  return (
    `Die Hälfte des Aufschlags für ${cat.category_display} entstand auf ` +
    `${whole.format(Math.max(1, length))} von ${whole.format(total)} km, ` +
    `zwischen km ${whole.format(span.startKm)} und ${whole.format(span.endKm)}.`
  );
}
