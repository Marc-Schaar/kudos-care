import { Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  WearDriver,
  WearImpactBreakdown,
  WearImpactCategory,
  WearImpactComponent,
} from '../../models/wear-impact';

interface PartLine {
  id: number;
  name: string;
  /** Wie viele Fahrten dieser Art die empfohlene Lebensdauer ergeben. */
  lifeInRides: string | null;
  sharePct: number | null;
}

interface CategoryRow {
  key: string;
  label: string;
  extraPct: number;
  driver: WearDriver | null;
  driverLabel: string | null;
  /** Wettergewichtete km dieser Kategorie (alle Teile einer Kategorie teilen den Multiplikator). */
  weightedKm: number;
  /** Breiten in Prozent der Zeichenfläche. */
  extraWidth: number;
  parts: PartLine[];
}

/**
 * Was eine Fahrt die Komponenten gekostet hat, als ein Maßstab für alle Bereiche.
 *
 * Der volle Balken ist überall gleich lang: die gefahrenen km. Was dahinter schraffiert
 * anschließt, ist der Wetteraufschlag dieser Kategorie. Dadurch steht der Multiplikator
 * auf einer gemeinsamen Achse und der teuerste Bereich fällt ohne Lesen auf.
 *
 * Bewusst keine Ampelfarben: der Aufschlag ist kein Zustand eines Teils, und die Ampel ist
 * in der App nur Status. Blau bekommt nur der Aufschlag, den Regen verursacht hat.
 */
@Component({
  selector: 'app-wear-impact',
  imports: [DecimalPipe],
  templateUrl: './wear-impact.html',
  styleUrl: './wear-impact.css',
})
export class WearImpact {
  breakdown = input.required<WearImpactBreakdown>();

  /** Kleinster Vollausschlag: ein Aufschlag von 2 % soll nicht wie eine Verdopplung aussehen. */
  private readonly scaleFloor = 1.25;

  readonly distanceKm = computed(() => this.breakdown().distance_km ?? 0);

  readonly scale = computed(() =>
    this.breakdown().categories.reduce(
      (max, cat) => Math.max(max, multiplierOf(cat)),
      this.scaleFloor,
    ),
  );

  /** Wo „gefahren" auf der Zeichenfläche endet, in Prozent. Für alle Zeilen gleich. */
  readonly baseWidth = computed(() => 100 / this.scale());

  readonly rows = computed<CategoryRow[]>(() =>
    this.breakdown().categories.map((cat) => {
      const multiplier = multiplierOf(cat);
      return {
        key: cat.category,
        label: cat.category_display,
        extraPct: Math.max(cat.extra_pct, 0),
        driver: cat.extra_pct > 0 ? cat.dominant_driver : null,
        driverLabel: cat.extra_pct > 0 ? cat.dominant_driver_display : null,
        weightedKm: this.distanceKm() * multiplier,
        extraWidth: ((multiplier - 1) / this.scale()) * 100,
        parts: cat.components.map(partLine),
      };
    }),
  );

  /** Die teuerste Kategorie, für den Satz oben. `null`, wenn das Wetter nichts gekostet hat. */
  readonly worst = computed(() => {
    const top = this.rows()[0];
    return top && top.extraPct > 0 ? top : null;
  });
}

/** Aus `extra_pct` statt `multiplier`, damit Balken und angezeigte Prozentzahl übereinstimmen. */
function multiplierOf(cat: WearImpactCategory): number {
  return 1 + Math.max(cat.extra_pct, 0) / 100;
}

function partLine(comp: WearImpactComponent): PartLine {
  const share = comp.share_of_life_pct;
  return {
    id: comp.id,
    name: comp.name,
    sharePct: share,
    lifeInRides: share ? lifeInRides(share) : null,
  };
}

/**
 * „2,5 % der Lebensdauer" ist korrekt, aber schwer zu greifen. „Etwa 40 Fahrten wie
 * diese" ist dieselbe Zahl, umgedreht, und die, nach der man sich richten kann.
 */
export function lifeInRides(sharePct: number): string {
  if (sharePct >= 100) return 'diese Fahrt allein war länger als seine Lebensdauer';
  const rides = 100 / sharePct;
  if (rides >= 1000) return 'hält über 1.000 Fahrten wie diese';
  const rounded = rides >= 20 ? Math.round(rides / 5) * 5 : Math.round(rides);
  return rounded === 1
    ? 'hält etwa eine Fahrt wie diese'
    : `hält etwa ${rounded} Fahrten wie diese`;
}
