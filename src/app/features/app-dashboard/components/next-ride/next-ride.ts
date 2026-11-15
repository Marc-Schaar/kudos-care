import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NavigationService } from '../../../../shared/services/navigation-service/navigation-service';
import { NextRideForecast } from '../../../app-maintenance/models/maintenance.models';
import { WarnClassPipe } from '../../../app-maintenance/pipes/warn-class/warn-class-pipe';
import { DueItem } from '../../../app-maintenance/shared/utils/utils';
import { buildForecast } from './forecast';
import { buildWeather } from './weather';

/**
 * Die Prognose auf der Startseite: wann fährst du voraussichtlich wieder, und was solltest du bis
 * dahin prüfen. Anders als die Vorhersage-Mail erscheint sie bei jedem Abstand, nicht erst, wenn
 * die nächste Fahrt etwas kritisch macht; die Mail ist der Alarm, das hier die Vorschau.
 *
 * Die Maßlinie ist zeitmaßstäblich (bis `RULER_DAYS`), damit "morgen" auch kurz aussieht.
 */
@Component({
  selector: 'app-next-ride',
  imports: [DatePipe, RouterLink, WarnClassPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './next-ride.html',
  styleUrl: './next-ride.css',
})
export class NextRide {
  readonly nav = inject(NavigationService);

  bikeId = input.required<number>();
  forecast = input.required<NextRideForecast>();
  /** Alle Posten des Rads (ungefiltert), aus denen Titel, Baugruppe und Restwert kommen. */
  due = input.required<DueItem[]>();

  view = computed(() => buildForecast(this.forecast(), this.due()));
  weather = computed(() => buildWeather(this.forecast().weather));

  link(item: DueItem) {
    return this.nav.to.assembly(this.bikeId(), item.assembly.id);
  }
}
