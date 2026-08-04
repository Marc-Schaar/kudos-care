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
}

@Injectable({
  providedIn: 'root',
})
export class StravaService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;
  private readonly router = inject(Router);
  private readonly notificationService: NotificationService = inject(NotificationService);

  public user = signal<{ athlete_id: number; firstname: string } | null>(null);
  public activities = signal<Activity[]>([]);
  public syncing = signal(false);

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
          return;
        }
        this.syncing.set(false);

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

  public fetchUser() {
    return this.http
      .get<{ athlete_id: number; firstname: string }>(`${this.baseUrl}/strava/me/`)
      .pipe(tap((userData) => this.user.set(userData)));
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
