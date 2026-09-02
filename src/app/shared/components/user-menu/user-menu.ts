import { Component, computed, ElementRef, HostListener, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NotificationService } from '../../services/notification-service/notification-service';
import { StravaService } from '../../services/strava-service/strava-service';

/**
 * Usermenü: E-Mail anzeigen/ändern, Benachrichtigungen abschalten, Abmelden.
 *
 * Bewusst eine Shared-Komponente, die in die bestehenden Seiten-Header eingehängt
 * wird (Dashboard, Wartung, Aktivität), statt einer globalen Topbar — so bleibt das
 * Layout aller Seiten unangetastet.
 */
@Component({
  selector: 'app-user-menu',
  imports: [FormsModule],
  templateUrl: './user-menu.html',
  styleUrl: './user-menu.css',
})
export class UserMenu {
  private readonly stravaService = inject(StravaService);
  private readonly notificationService = inject(NotificationService);
  private readonly host = inject(ElementRef<HTMLElement>);

  open = signal(false);
  editingEmail = signal(false);
  saving = signal(false);
  emailDraft = '';

  user = this.stravaService.user;

  initial = computed(() => {
    const name = this.user()?.firstname?.trim();
    return name ? name.charAt(0).toUpperCase() : '·';
  });

  /** Klick ausserhalb schliesst das Menü — sonst bleibt es beim Navigieren offen stehen. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.open()) this.close();
  }

  toggle() {
    this.open.update((value) => !value);
    if (this.open()) {
      this.emailDraft = this.user()?.email ?? '';
      this.editingEmail.set(!this.user()?.email);
    }
  }

  close() {
    this.open.set(false);
    this.editingEmail.set(false);
  }

  startEditingEmail() {
    this.emailDraft = this.user()?.email ?? '';
    this.editingEmail.set(true);
  }

  saveEmail() {
    const email = this.emailDraft.trim();
    if (!email) {
      this.notificationService.show('Bitte eine E-Mail-Adresse eingeben.', 'error');
      return;
    }

    this.saving.set(true);
    this.stravaService.updateSettings({ email }).subscribe({
      next: () => {
        this.saving.set(false);
        this.editingEmail.set(false);
        this.notificationService.show('E-Mail-Adresse gespeichert.', 'success');
      },
      error: () => {
        this.saving.set(false);
        this.notificationService.show('E-Mail-Adresse konnte nicht gespeichert werden.', 'error');
      },
    });
  }

  toggleNotifications() {
    const enabled = !this.user()?.email_notifications_enabled;
    this.saving.set(true);
    this.stravaService.updateSettings({ email_notifications_enabled: enabled }).subscribe({
      next: () => {
        this.saving.set(false);
        this.notificationService.show(
          enabled ? 'Benachrichtigungen aktiviert.' : 'Benachrichtigungen abgeschaltet.',
          'info',
        );
      },
      error: () => {
        this.saving.set(false);
        this.notificationService.show('Einstellung konnte nicht gespeichert werden.', 'error');
      },
    });
  }

  logout() {
    this.close();
    this.stravaService.logout();
  }

  // ── Konto löschen ───────────────────────────────────────────────────────────
  /**
   * Zwei Schritte statt eines Dialogs: der erste Klick blendet die Warnung mit
   * dem endgültigen Knopf ein. Das Löschen entfernt Fahrten, Bikes und die
   * komplette Verschleiß-Historie und ist nicht rückgängig zu machen.
   */
  confirmingDelete = signal(false);
  deleting = signal(false);

  requestDelete() {
    this.confirmingDelete.set(true);
  }

  cancelDelete() {
    this.confirmingDelete.set(false);
  }

  deleteAccount() {
    this.deleting.set(true);
    this.stravaService.deleteAccount().subscribe({
      next: () => {
        this.deleting.set(false);
        this.confirmingDelete.set(false);
        this.close();
        this.notificationService.show('Konto und alle Daten gelöscht.', 'success');
        // Die Session ist serverseitig weg — den lokalen Zustand mitnehmen.
        this.stravaService.logout();
      },
      error: (err) => {
        this.deleting.set(false);
        this.notificationService.show(err?.error?.error ?? 'Löschen fehlgeschlagen.', 'error');
      },
    });
  }
}
