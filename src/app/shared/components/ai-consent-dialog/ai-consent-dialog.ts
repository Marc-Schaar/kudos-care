import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AiConsentService } from '../../services/ai-consent-service/ai-consent-service';
import { NavigationService } from '../../services/navigation-service/navigation-service';
import { StravaService } from '../../services/strava-service/strava-service';

/**
 * Einmalige Rückfrage vor dem ersten KI-Text, ausgelöst vom `aiConsentInterceptor`. Stravas API
 * Agreement verlangt für die Weitergabe an Dritte eine ausdrückliche Einwilligung. Teilt sich das
 * Aussehen mit dem E-Mail-Dialog.
 */
@Component({
  selector: 'app-ai-consent-dialog',
  imports: [RouterLink],
  templateUrl: './ai-consent-dialog.html',
  styleUrl: '../email-prompt-dialog/email-prompt-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiConsentDialog {
  readonly consent = inject(AiConsentService);
  readonly nav = inject(NavigationService);
  private readonly stravaService = inject(StravaService);

  readonly saving = signal(false);
  readonly error = signal(false);

  accept(): void {
    this.saving.set(true);
    this.error.set(false);
    this.stravaService.updateSettings({ ai_consent: true }).subscribe({
      next: () => {
        this.saving.set(false);
        this.consent.answer(true);
      },
      error: () => {
        this.saving.set(false);
        this.error.set(true);
      },
    });
  }

  decline(): void {
    this.error.set(false);
    this.consent.answer(false);
  }
}
