import { DecimalPipe } from '@angular/common';
import { Component, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BikeDetail } from '../../models/maintenance.models';
import { WarnClassPipe } from '../../pipes/warn-class/warn-class-pipe';
import { WarnLabelPipe } from '../../pipes/warn-label/warn-label-pipe';
import { NavigationService } from '../../../../shared/services/navigation-service/navigation-service';

/**
 * Kopfzeile eines Bikes — identisch auf der Zustands- und der Werkstatt-Seite,
 * damit beim Wechsel zwischen beiden nichts springt und immer klar bleibt,
 * welches Rad man gerade vor sich hat.
 */
@Component({
  selector: 'app-bike-header-component',
  imports: [RouterLink, DecimalPipe, WarnClassPipe, WarnLabelPipe],
  templateUrl: './bike-header-component.html',
  styleUrl: './bike-header-component.css',
})
export class BikeHeaderComponent {
  readonly nav = inject(NavigationService);
  bike = input.required<BikeDetail>();
  /** Nur auf der Werkstatt-Seite sinnvoll — die Zustandsseite bleibt lesend. */
  showEdit = input(false);
  edit = output<void>();
  /**
   * Macht die Ampel antippbar. Die Zustandsseite nutzt das, um von "kritisch"
   * zu dem zu springen, was den Status verursacht; die Werkstatt hat kein
   * solches Ziel und lässt den Badge als reine Anzeige.
   */
  statusClickable = input(false);
  statusClick = output<void>();
}
