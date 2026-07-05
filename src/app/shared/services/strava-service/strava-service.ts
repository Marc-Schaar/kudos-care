import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from './../../../../environments/environment';
import { of, tap } from 'rxjs';
import { NotificationService } from '../notification-service/notification-service';

export interface BikeResponse {
  bikes: Bike[];
}

export interface Bike {
  id: number;
  name: string;
  strava_bike_id: string;
  bike_type: string;
  bike_type_display: string;
  retired: boolean;
  total_distance_km: number | null;
  warn_status: string;
}

export interface Activity {
  id: string;
  name: string;
  distance: number;
  type: string;
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
  public bikes = signal<Bike[]>([]);
  public activities = signal<Activity[]>([]);

  public syncDataBase() {
    return this.http.post(`${this.baseUrl}/strava/sync/`, {}).pipe(
      tap((res) => {
        this.notificationService.show('Datenbank-Synchronisierung erfolgreich', 'success');
      }),
    );
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
        this.bikes.set([]);
        this.activities.set([]);
        this.router.navigate(['/login']);
      },
      error: (err) => {
        console.error('Logout failed', err);
      },
    });
  }
}
