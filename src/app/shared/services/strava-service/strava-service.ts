import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from './../../../../environments/environment';
import { tap } from 'rxjs';

export interface Bike {
  id: string;
  name: string;
  distance: number;
  primary: boolean;
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

  public fetchBikes(athleteId: number) {
    return (
      this.http
        // .get<{ bikes: Bike[] }>(`${this.baseUrl}/strava/bikes/${athleteId}/`)
        .get<{ bikes: Bike[] }>(`${this.baseUrl}/maintenance/bikes/`)
        .pipe(tap((res) => this.bikes.set(res.bikes)))
    );
  }

  public fetchActivities() {
    return this.http.get<Activity[]>(`${this.baseUrl}/activities/`).pipe(
      tap((res) => {
        console.log('Empfangene Aktivitäten:', res);
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
