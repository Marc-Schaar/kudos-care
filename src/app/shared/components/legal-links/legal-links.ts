import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NavigationService } from '../../services/navigation-service/navigation-service';

/**
 * Impressum und Datenschutz, auf Wunsch mit dem offiziellen "Powered by Strava"-Logo. Das Logo ist
 * Pflicht-Material aus Stravas Brand Guidelines und darf nicht verändert werden.
 */
@Component({
  selector: 'app-legal-links',
  imports: [RouterLink],
  templateUrl: './legal-links.html',
  styleUrl: './legal-links.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LegalLinks {
  readonly nav = inject(NavigationService);
  /** Dort zeigen, wo Strava-Daten zu sehen sind. Die Landing-Page zeigt nur Beispieldaten. */
  readonly attribution = input(false);
}
