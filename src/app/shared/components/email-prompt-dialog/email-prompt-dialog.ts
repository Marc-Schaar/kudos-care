import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NotificationService } from '../../services/notification-service/notification-service';
import { StravaService } from '../../services/strava-service/strava-service';

/**
 * Einmaliger Dialog für Nutzer ohne hinterlegte E-Mail-Adresse.
 *
 * Ohne Adresse verschickt das Backend gar keine Wartungs-Warnungen
 * (`app_notifications.services.send_templated_email()` bricht still ab) — der Nutzer
 * merkt davon aber nie etwas. Deshalb fragt die App beim nächsten Login danach.
 *
 * Liegt in der App-Shell und reagiert per `effect()` auf das `user`-Signal, damit er
 * unabhängig davon erscheint, auf welcher Seite der Nutzer landet. "Später" merkt sich
 * die Entscheidung in `sessionStorage`, damit er nicht bei jeder Navigation nervt —
 * bewusst nicht `localStorage`, sonst käme er nie wieder.
 */
@Component({
  selector: 'app-email-prompt-dialog',
  imports: [FormsModule],
  templateUrl: './email-prompt-dialog.html',
  styleUrl: './email-prompt-dialog.css',
})
export class EmailPromptDialog {
  private readonly stravaService = inject(StravaService);
  private readonly notificationService = inject(NotificationService);
  private static readonly dismissKey = 'kudos_care_email_prompt_dismissed';

  visible = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);
  email = '';

  constructor() {
    effect(() => {
      const user = this.stravaService.user();
      if (user?.needs_email && !this.wasDismissed()) {
        this.visible.set(true);
      } else if (!user?.needs_email) {
        this.visible.set(false);
      }
    });
  }

  private wasDismissed(): boolean {
    try {
      return sessionStorage.getItem(EmailPromptDialog.dismissKey) === '1';
    } catch {
      // Private Modus / blockierte Storage-APIs: dann lieber fragen als schweigen.
      return false;
    }
  }

  save() {
    const email = this.email.trim();
    if (!email) {
      this.error.set('Bitte eine E-Mail-Adresse eingeben.');
      return;
    }

    this.error.set(null);
    this.saving.set(true);
    this.stravaService.updateSettings({ email }).subscribe({
      next: () => {
        this.saving.set(false);
        this.visible.set(false);
        this.notificationService.show('E-Mail-Adresse gespeichert.', 'success');
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(
          err?.status === 400
            ? 'Das sieht nicht nach einer gültigen E-Mail-Adresse aus.'
            : 'Speichern fehlgeschlagen. Bitte später erneut versuchen.',
        );
      },
    });
  }

  dismiss() {
    try {
      sessionStorage.setItem(EmailPromptDialog.dismissKey, '1');
    } catch {
      // Nicht kritisch — dann fragt der Dialog beim nächsten Laden erneut.
    }
    this.visible.set(false);
  }
}
