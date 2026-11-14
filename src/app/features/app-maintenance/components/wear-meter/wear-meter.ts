import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BikeComponent, WarnStatus } from '../../models/maintenance.models';
import { WarnClassPipe } from '../../pipes/warn-class/warn-class-pipe';
import { weatherSurplusKm } from '../../shared/utils/utils';

/** Das Lineal reicht bis 125 %: so bleibt rechts der Grenze Platz, um sie zu überschreiten. */
const SCALE_MAX = 1.25;
const toPercent = (ratio: number): number => (Math.min(ratio, SCALE_MAX) / SCALE_MAX) * 100;

/**
 * Das Vielfache der Lebensdauer hinter der Bruchkante: "1,3×", "7,1×", ab zehn ganzzahlig, damit
 * es auch am Handy in den Rest des Lineals passt. Abgerundet, damit 1,96 nicht als "2×" erscheint.
 */
export function formatTimes(ratio: number): string {
  if (ratio >= 99) return '99+×';
  const value = ratio >= 10 ? Math.floor(ratio) : Math.floor(ratio * 10) / 10;
  return `${value.toLocaleString('de-DE', { maximumFractionDigits: 1 })}×`;
}

/**
 * Das Verschleiß-Lineal: wie viel von der Lebensdauer verbraucht ist, gemessen an Marken bei 80 %
 * (Ampel springt auf "bald fällig") und 100 % (Grenze).
 *
 * Mit `[part]` zeigt es zusätzlich, was das Wetter auf die gefahrenen Kilometer aufschlägt, als
 * schraffiertes Stück hinter dem Tacho-Stand. Genau dieser Abstand ist das, was der Tacho nicht
 * weiß. Das Lineal endet über der Grenze mit einer Spitze, die genaue Zahl steht als Text daneben.
 */
@Component({
  selector: 'app-wear-meter',
  imports: [WarnClassPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rule" role="img" [attr.aria-label]="label()">
      <div class="track"></div>
      @if (past()) {
        <!-- Über der Skala: bis kurz hinter die Grenze, dann die Bruchkante wie in einer
             Konstruktionszeichnung, danach das echte Vielfache statt eines immer gleich
             langen Balkens. -->
        <div class="fill" [class]="effectiveStatus() | warnClass" style="width: 81.5%"></div>
        <div class="overrun" [class]="effectiveStatus() | warnClass">
          <span class="break" aria-hidden="true"></span>
          <span class="tail"></span>
          <span class="times g-num">{{ times() }}</span>
        </div>
      } @else {
        <div class="fill" [class]="effectiveStatus() | warnClass" [style.width.%]="solid()"></div>
        @if (surcharge() > 0) {
          <div class="surcharge" [style.left.%]="solid()" [style.width.%]="surcharge()"></div>
        }
      }
      <span class="mark" style="left: 64%"></span>
      <span class="mark limit" style="left: 80%"></span>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .rule {
      position: relative;
      height: 0.75rem;
    }

    .track {
      position: absolute;
      inset: auto 0 0.2rem;
      height: 0.35rem;
      background: var(--border);
      border-radius: 2px;
    }

    .fill,
    .surcharge {
      position: absolute;
      bottom: 0.2rem;
      height: 0.35rem;
      min-width: 2px;
    }

    .fill {
      left: 0;
      background: var(--border-strong);
      border-radius: 2px;
    }

    .fill.status-ok {
      background: var(--ok);
    }

    .fill.status-warn {
      background: var(--warn);
    }

    .fill.status-critical {
      background: var(--critical);
    }

    .surcharge {
      /* Schraffiert statt nur blau: bleibt auch ohne Farbsehen vom Tacho-Stand unterscheidbar. */
      background: repeating-linear-gradient(
        -45deg,
        var(--rain) 0 2px,
        color-mix(in srgb, var(--rain) 25%, transparent) 2px 4px
      );
      border-radius: 0 2px 2px 0;
    }

    /* Über 125 % geht die Skala nicht weiter. Statt einer Spitze, die bei 130 % und bei 700 %
       gleich aussieht, bricht das Lineal ab und nennt das Vielfache der Lebensdauer. */
    .rule:has(.overrun) {
      height: 1rem;
    }

    .overrun {
      position: absolute;
      left: 81.5%;
      right: 0;
      bottom: 0;
      height: 1rem;
      display: flex;
      align-items: flex-end;
      --c: var(--border-strong);
    }

    .overrun.status-warn {
      --c: var(--warn);
    }

    .overrun.status-critical {
      --c: var(--critical);
    }

    /* Zwei parallele Schrägstriche, dazwischen Lücke: die Achse ist hier unterbrochen. */
    .break {
      flex: none;
      position: relative;
      width: 0.55rem;
      height: 0.8rem;
      margin: 0 0.1rem 0 0.15rem;
    }

    .break::before,
    .break::after {
      content: '';
      position: absolute;
      bottom: 0;
      width: 1.5px;
      height: 100%;
      background: var(--c);
      transform: skewX(-24deg);
      transform-origin: bottom;
    }

    .break::before {
      left: 0.1rem;
    }

    .break::after {
      left: 0.4rem;
    }

    .tail {
      flex: 1;
      min-width: 3px;
      height: 0.35rem;
      margin-bottom: 0.2rem;
      background: var(--c);
      border-radius: 0 2px 2px 0;
    }

    .times {
      flex: none;
      padding-left: 0.3rem;
      font-size: var(--t-xs);
      line-height: 1;
      font-weight: 600;
      color: var(--c);
    }

    .mark {
      position: absolute;
      bottom: 0;
      width: 1px;
      height: 0.75rem;
      background: var(--border-strong);
      opacity: 0.55;
    }

    .mark.limit {
      opacity: 1;
    }
  `,
})
export class WearMeter {
  /** Verbrauchter Anteil auf der schlechtesten Achse. Ohne `part` zählt nur dieser Wert. */
  ratio = input<number | null | undefined>(null);
  status = input<WarnStatus>('unknown');
  /** Das Teil selbst, dann kann das Lineal Tacho und Wetter getrennt zeichnen. */
  part = input<BikeComponent | null>(null);

  private overall = computed(() => this.part()?.wear_ratio ?? this.ratio() ?? 0);

  effectiveStatus = computed(() => this.part()?.warn_status_overall ?? this.status());

  /**
   * Der Wetter-Anteil gilt nur, wenn das Wetter auch die Achse ist, die zählt. Treibt die Tage-Achse
   * die Ampel (etwa Dichtmilch nach 120 Tagen), wäre ein km-Aufschlag daneben irreführend.
   */
  private kmRatio = computed(() => {
    const part = this.part();
    if (!part?.effective_warn_km || weatherSurplusKm(part) === null) return null;
    const weatherRatio = part.weather_wear_km! / part.effective_warn_km;
    return Math.abs(weatherRatio - this.overall()) < 0.01 ? part.wear_km / part.effective_warn_km : null;
  });

  solid = computed(() => toPercent(this.kmRatio() ?? this.overall()));

  surcharge = computed(() => {
    const kmRatio = this.kmRatio();
    return kmRatio === null ? 0 : toPercent(this.overall()) - toPercent(kmRatio);
  });

  past = computed(() => this.overall() > SCALE_MAX);

  times = computed(() => formatTimes(this.overall()));

  label = computed(() => {
    const percent = Math.round(this.overall() * 100);
    if (this.past()) return `${percent} % der Lebensdauer verbraucht, das ${this.times()}-Fache`;
    const kmRatio = this.kmRatio();
    return kmRatio === null
      ? `${percent} % der Lebensdauer verbraucht`
      : `${percent} % der Lebensdauer verbraucht, davon ${Math.round(kmRatio * 100)} % laut Tacho`;
  });
}

/** Die Legende zum Lineal. Einmal je Liste, nicht an jeder Zeile. */
@Component({
  selector: 'app-wear-legend',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="key"><i class="swatch"></i>Tacho</span>
    <span class="key"><i class="swatch weather"></i>Aufschlag durch Wetter</span>
    <span class="key"><i class="swatch limit"></i>Grenze</span>
    <span class="key"><i class="swatch break"></i>Skala gebrochen, × Lebensdauer</span>
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem 1rem;
      font-size: var(--t-xs);
      color: var(--muted);
    }

    .key {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }

    .swatch {
      display: inline-block;
      width: 1rem;
      height: 0.35rem;
      background: var(--border-strong);
      border-radius: 2px;
    }

    .swatch.weather {
      background: repeating-linear-gradient(
        -45deg,
        var(--rain) 0 2px,
        color-mix(in srgb, var(--rain) 25%, transparent) 2px 4px
      );
    }

    .swatch.limit {
      width: 1px;
      height: 0.75rem;
      border-radius: 0;
    }

    .swatch.break {
      width: 0.55rem;
      height: 0.75rem;
      background:
        linear-gradient(var(--border-strong), var(--border-strong)) 0.1rem 0 / 1.5px 100% no-repeat,
        linear-gradient(var(--border-strong), var(--border-strong)) 0.4rem 0 / 1.5px 100% no-repeat;
      transform: skewX(-24deg);
      border-radius: 0;
    }
  `,
})
export class WearLegend {}
