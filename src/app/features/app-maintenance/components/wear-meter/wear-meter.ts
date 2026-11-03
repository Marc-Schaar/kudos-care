import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BikeComponent, WarnStatus } from '../../models/maintenance.models';
import { WarnClassPipe } from '../../pipes/warn-class/warn-class-pipe';
import { weatherSurplusKm } from '../../shared/utils/utils';

/** Das Lineal reicht bis 125 %: so bleibt rechts der Grenze Platz, um sie zu überschreiten. */
const SCALE_MAX = 1.25;
const toPercent = (ratio: number): number => (Math.min(ratio, SCALE_MAX) / SCALE_MAX) * 100;

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
      <div class="fill" [class]="effectiveStatus() | warnClass" [style.width.%]="solid()">
        @if (past() && surcharge() === 0) {
          <span class="tip"></span>
        }
      </div>
      @if (surcharge() > 0) {
        <div class="surcharge" [style.left.%]="solid()" [style.width.%]="surcharge()"></div>
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

    /* Über 125 % läuft der Balken nicht weiter, die Spitze sagt: geht noch weiter. */
    .tip {
      position: absolute;
      top: 50%;
      right: -1px;
      width: 0.5rem;
      height: 0.5rem;
      background: inherit;
      transform: translateY(-50%) rotate(45deg);
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

  label = computed(() => {
    const percent = Math.round(this.overall() * 100);
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
  `,
})
export class WearLegend {}
