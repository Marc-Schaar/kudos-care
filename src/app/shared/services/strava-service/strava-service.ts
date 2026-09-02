import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from './../../../../environments/environment';
import { interval, switchMap, takeWhile, tap } from 'rxjs';
import { NotificationService } from '../notification-service/notification-service';

export interface Activity {
  id: number;
  name: string;
  distance: number | null;
  start_date: string | null;
  elapsed_time: number | null;
  bike: number | null;
}

export interface SyncStatusResponse {
  sync_status: 'idle' | 'running' | 'success' | 'error' | 'cancelled';
  sync_started_at: string | null;
  sync_finished_at: string | null;
  sync_error: string;
  last_sync_count: number | null;
  sync_progress_current: number | null;
  sync_progress_total: number | null;
}

export interface SyncProgress {
  current: number;
  total: number | null;
}

/**
 * Antwort von GET /api/strava/me/.
 *
 * `firstname` kommt NICHT vom Backend (der Name wird dort bewusst nicht persistiert),
 * sondern aus dem localStorage-Cache — siehe setLoggedInUser(). `needs_email` steuert
 * den Dialog beim nächsten Login: ohne Adresse verschickt das Backend gar nichts.
 */
export interface CurrentUser {
  athlete_id: number;
  firstname: string | null;
  email: string;
  email_notifications_enabled: boolean;
  needs_email: boolean;
}

export interface UserSettingsPatch {
  email?: string;
  email_notifications_enabled?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class StravaService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;
  private readonly router = inject(Router);
  private readonly notificationService: NotificationService = inject(NotificationService);

  private readonly displayNameStorageKey = 'kudos_care_display_name';

  public user = signal<CurrentUser | null>(null);
  public activities = signal<Activity[]>([]);
  public syncing = signal(false);
  public syncProgress = signal<SyncProgress | null>(null);

  public triggerSync() {
    return this.http.post<{ status: string }>(`${this.baseUrl}/strava/sync/`, {}).pipe(
      tap(() => {
        this.notificationService.show('Synchronisierung gestartet…', 'info');
        this.startPolling();
      }),
    );
  }

  public cancelSync() {
    return this.http
      .post<{ status: string }>(`${this.baseUrl}/strava/sync/cancel/`, {})
      .pipe(tap(() => this.syncing.set(false)));
  }

  public checkOngoingSync() {
    return this.fetchSyncStatus().pipe(
      tap((res) => {
        if (res.sync_status === 'running') {
          this.notificationService.show('Synchronisierung läuft im Hintergrund…', 'info');
          this.startPolling();
        }
      }),
    );
  }

  private fetchSyncStatus() {
    return this.http.get<SyncStatusResponse>(`${this.baseUrl}/strava/sync-status/`);
  }

  private startPolling() {
    if (this.syncing()) {
      return;
    }
    this.syncing.set(true);

    interval(3000)
      .pipe(
        switchMap(() => this.fetchSyncStatus()),
        takeWhile((res) => res.sync_status === 'running', true),
      )
      .subscribe((res) => {
        if (res.sync_status === 'running') {
          this.syncProgress.set(
            res.sync_progress_current != null
              ? { current: res.sync_progress_current, total: res.sync_progress_total }
              : null,
          );
          return;
        }
        this.syncing.set(false);
        this.syncProgress.set(null);

        if (res.sync_status === 'success') {
          this.notificationService.show(
            `Synchronisierung abgeschlossen (${res.last_sync_count ?? 0} Aktivitäten)`,
            'success',
          );
          this.fetchActivities().subscribe();
        } else if (res.sync_status === 'error') {
          this.notificationService.show(
            res.sync_error || 'Synchronisierung fehlgeschlagen',
            'error',
          );
        } else if (res.sync_status === 'cancelled') {
          this.notificationService.show('Synchronisierung abgebrochen', 'info');
        }
      });
  }

  /**
   * Der echte Name wird bewusst nicht vom Backend geliefert (landet nicht in der DB),
   * sondern beim Login einmalig clientseitig gecacht — siehe setLoggedInUser().
   */
  public fetchUser() {
    return this.http.get<Omit<CurrentUser, 'firstname'>>(`${this.baseUrl}/strava/me/`).pipe(
      tap((userData) =>
        this.user.set({
          ...userData,
          firstname: localStorage.getItem(this.displayNameStorageKey),
        }),
      ),
    );
  }

  public setLoggedInUser(athleteId: number, firstname: string) {
    if (firstname) {
      localStorage.setItem(this.displayNameStorageKey, firstname);
    }
    // Login-Response kennt E-Mail/Flags nicht — fetchUser() fuellt sie gleich nach,
    // bis dahin konservative Defaults (kein voreiliger E-Mail-Dialog).
    this.user.set({
      athlete_id: athleteId,
      firstname: firstname || null,
      email: '',
      email_notifications_enabled: true,
      needs_email: false,
    });
  }

  /** E-Mail und/oder Benachrichtigungs-Schalter aendern (Usermenue, E-Mail-Dialog). */
  public updateSettings(patch: UserSettingsPatch) {
    return this.http
      .patch<Omit<CurrentUser, 'firstname'>>(`${this.baseUrl}/strava/me/`, patch)
      .pipe(
        tap((userData) =>
          this.user.update((current) => ({
            ...userData,
            firstname: current?.firstname ?? null,
          })),
        ),
      );
  }

  /**
   * Loescht das Konto samt aller Daten (Art. 17 DSGVO).
   *
   * `confirm=true` verlangt das Backend zusaetzlich zur Rueckfrage im Client —
   * ein versehentlich abgesetztes DELETE wuerde jahrelange Fahrthistorie
   * unwiederbringlich entfernen.
   */
  public deleteAccount() {
    return this.http.delete<void>(`${this.baseUrl}/strava/me/?confirm=true`);
  }

  /**
   * Nur fuer lokale Entwicklung (siehe environment.devLoginEnabled) — ruft den
   * Dev-Mock-Login des Backends auf (existiert dort nur bei DEBUG=True) statt des
   * echten Strava-OAuth-Roundtrips.
   */
  public devLogin() {
    return this.http
      .post<{ athlete: { id: number; firstname: string } }>(`${this.baseUrl}/dev/login/`, {})
      .pipe(tap((res) => this.setLoggedInUser(res.athlete.id, res.athlete.firstname)));
  }

  public fetchActivities() {
    return this.http.get<Activity[]>(`${this.baseUrl}/activities/`).pipe(
      tap((res) => {
        this.activities.set(res);
      }),
    );
  }

  public logout() {
    this.http.post(`${this.baseUrl}/strava/logout/`, {}).subscribe({
      next: () => {
        localStorage.removeItem(this.displayNameStorageKey);
        this.user.set(null);
        this.activities.set([]);
        this.router.navigate(['/login']);
      },
      error: (err) => {
        console.error('Logout failed', err);
      },
    });
  }
}
