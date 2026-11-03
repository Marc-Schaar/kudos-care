import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../../../shared/components/icon/icon';
import { NavigationService } from '../../../../shared/services/navigation-service/navigation-service';
import { BikeAssembly, BikeType } from '../../models/maintenance.models';
import { WarnClassPipe } from '../../pipes/warn-class/warn-class-pipe';
import {
  buildCallouts,
  HUB_SPAN,
  largestWeatherGap,
  NARROW,
  WIDE,
} from '../../shared/utils/blueprint';

/**
 * Die Werkstattzeichnung: das eigene Rad wie im Dealer-Manual, mit Hinweislinien auf die
 * Baugruppen und darunter Tacho und Wetter als zwei Maßlinien. Sie beantwortet, was eine Liste
 * nicht kann: wo am Rad das sitzt, worum man sich kümmern muss.
 *
 * Ohne Befund bleiben die Linien im Tintengrau, nur die Ampel darf laut werden. Es gibt zwei
 * Fassungen, weil Beschriftung neben dem Rad unter rund 860 px nicht mehr passt: dann tragen die
 * Punkte Nummern und die Beschriftung steht als Liste darunter. Umgeschaltet wird per
 * Container-Query, die Zeichnung passt sich also ihrem Platz an, nicht dem Bildschirm.
 */
@Component({
  selector: 'app-bike-blueprint',
  imports: [DecimalPipe, Icon, NgTemplateOutlet, RouterLink, WarnClassPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bike-blueprint.html',
  styleUrl: './bike-blueprint.css',
})
export class BikeBlueprint {
  readonly nav = inject(NavigationService);

  bikeId = input.required<number>();
  bikeType = input.required<BikeType>();
  /** Nur was gerade am Rad ist. Geparkte Sätze liegen im Keller und nicht in dieser Zeichnung. */
  assemblies = input.required<BikeAssembly[]>();

  /** Die Baugruppe, über der gerade der Zeiger oder der Tastaturfokus liegt. */
  hot = signal<number | null>(null);

  /** Die Liste unter der schmalen Fassung: aufgeklappt oder nur mit dem, was ansteht. */
  showAll = signal(false);

  callouts = computed(() => buildCallouts(this.assemblies(), this.bikeType()));
  private attention = computed(() =>
    this.callouts().filter((callout) => callout.status === 'warn' || callout.status === 'critical'),
  );
  legendRows = computed(() => {
    if (this.showAll() || this.attention().length === 0) return this.callouts();
    return this.attention();
  });
  quietCount = computed(() =>
    this.attention().length === 0 ? 0 : this.callouts().length - this.attention().length,
  );
  placed = computed(() => this.callouts().filter((callout) => callout.leader !== null));
  gap = computed(() => largestWeatherGap(this.assemblies()));
  image = computed(() => `bike-illustrations/${this.bikeType()}.svg`);

  readonly wide = WIDE;
  readonly narrow = NARROW;

  /** Lage des Bilds in Prozent der jeweiligen Fassung. */
  readonly wideArt = {
    left: (WIDE.bikeX / WIDE.w) * 100,
    top: (WIDE.bikeY / WIDE.h) * 100,
    width: ((400 * WIDE.scale) / WIDE.w) * 100,
  };

  /** Die Tacho-Linie reicht in beiden Fassungen genau von Nabe zu Nabe. */
  wideDim = computed(() => this.dimension(WIDE.bikeX, WIDE.scale, WIDE.w));
  narrowDim = computed(() => this.dimension(0, 1, NARROW.w));

  private dimension(originX: number, scale: number, total: number) {
    const left = ((originX + HUB_SPAN.rear * scale) / total) * 100;
    const width = ((HUB_SPAN.length * scale) / total) * 100;
    return { left, width, stretched: width * (this.gap()?.stretch ?? 1) };
  }

  percentOf(value: number, total: number): number {
    return (value / total) * 100;
  }
}
