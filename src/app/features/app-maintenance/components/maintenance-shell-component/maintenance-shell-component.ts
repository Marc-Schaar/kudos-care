import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { BikeService } from '../../services/bike-service/bike-service';

/**
 * Rahmen um den gesamten Wartungsbereich: Router-Outlet plus die untere
 * Navigationsleiste (Bikes / Zustand / Werkstatt).
 *
 * Die Leiste liegt hier und nicht in den einzelnen Seiten, damit sie beim
 * Seitenwechsel stehen bleibt und nicht mitscrollt. Die Seiten selbst halten
 * unten Abstand (`--nav-height`), sonst verschwindet ihr letztes Element
 * darunter.
 *
 * "Zustand" und "Werkstatt" brauchen ein Bike. Solange keins gewaehlt ist
 * (Erstaufruf der Liste), sind die beiden Ziele deaktiviert statt versteckt —
 * ein Tab, der mal da ist und mal nicht, laesst die Leiste springen.
 */
@Component({
  selector: 'app-maintenance-shell-component',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './maintenance-shell-component.html',
  styleUrl: './maintenance-shell-component.css',
})
export class MaintenanceShellComponent {
  private readonly bikeService = inject(BikeService);

  /**
   * Das zuletzt geoeffnete Bike. `selectedBike` wird von `fetchBikeDetails()`
   * gesetzt und ueberlebt den Wechsel zurueck zur Liste — genau das macht die
   * beiden Bike-Tabs von dort aus erreichbar.
   */
  readonly bikeId = computed(() => this.bikeService.selectedBike()?.id ?? null);
  readonly bikeName = computed(() => this.bikeService.selectedBike()?.name ?? null);
}
