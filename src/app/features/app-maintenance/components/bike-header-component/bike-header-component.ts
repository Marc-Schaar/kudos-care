import { DecimalPipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BikeDetail } from '../../models/maintenance.models';
import { WarnClassPipe } from '../../pipes/warn-class/warn-class-pipe';
import { WarnLabelPipe } from '../../pipes/warn-label/warn-label-pipe';

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
  bike = input.required<BikeDetail>();
  /** Nur auf der Werkstatt-Seite sinnvoll — die Zustandsseite bleibt lesend. */
  showEdit = input(false);
  edit = output<void>();
}
