import { ChangeDetectionStrategy, Component, afterNextRender, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NavigationService } from '../../../../shared/services/navigation-service/navigation-service';
import { LEGAL_CONTACT } from '../../legal-contact';

/** Impressum nach § 5 DDG (`/impressum`, öffentlich). */
@Component({
  selector: 'app-imprint',
  imports: [RouterLink],
  templateUrl: './imprint.html',
  styleUrl: '../legal-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Imprint {
  readonly nav = inject(NavigationService);
  readonly contact = LEGAL_CONTACT;

  constructor() {
    // Von der langen Landing-Page kommend bliebe sonst deren Scroll-Position stehen.
    afterNextRender(() => window.scrollTo(0, 0));
  }
}
