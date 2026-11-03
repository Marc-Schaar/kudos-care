import { ChangeDetectionStrategy, Component, afterNextRender, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NavigationService } from '../../../../shared/services/navigation-service/navigation-service';
import { LEGAL_CONTACT } from '../../legal-contact';

/**
 * Datenschutzerklärung (`/datenschutz`, öffentlich). Beschreibt, was der Code tatsächlich tut:
 * kommt ein externer Dienst, ein Cookie oder ein neues Feld dazu, gehört es hierher.
 */
@Component({
  selector: 'app-privacy',
  imports: [RouterLink],
  templateUrl: './privacy.html',
  styleUrl: '../legal-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Privacy {
  readonly nav = inject(NavigationService);
  readonly contact = LEGAL_CONTACT;

  constructor() {
    // Von der langen Landing-Page kommend bliebe sonst deren Scroll-Position stehen.
    afterNextRender(() => window.scrollTo(0, 0));
  }
}
