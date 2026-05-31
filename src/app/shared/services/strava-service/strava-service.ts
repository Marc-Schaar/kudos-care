import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from './../../../../environments/environment';
import { tap } from 'rxjs';

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
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;
  private router = inject(Router);

  public user = signal<{ athlete_id: number; firstname: string } | null>(null);
  public bikes = signal<Bike[]>([]);
  public activities = signal<Activity[]>([]);

  public syncDataBase() {
    return this.http.post(`${this.baseUrl}/strava/sync/`, {}).pipe(
      tap((res) => {
        console.log('Datenbank-Synchronisierung erfolgreich', res);
      }),
    );
  }

  public fetchUser() {
    return this.http
      .get<{ athlete_id: number; firstname: string }>(`${this.baseUrl}/strava/me/`)
      .pipe(tap((userData) => this.user.set(userData)));
  }

  public fetchBikes() {
    return this.http.get<BikeResponse>(`${this.baseUrl}/maintenance/bikes/`).pipe(
      tap((res) => {
        this.bikes.set(res.bikes);
      }),
    );
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
      next: (res) => {
        this.router.navigate(['/login']);
      },
      error: (err) => {
        console.error('Logout failed', err);
      },
    });
  }
}
