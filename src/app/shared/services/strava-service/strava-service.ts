import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { switchMap, tap } from 'rxjs';

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
  private baseUrl = 'http://localhost:8000/api';
  private router = inject(Router);

  public user = signal<{ athlete_id: number; firstname: string } | null>(null);
  public bikes = signal<Bike[]>([]);
  public activities = signal<Activity[]>([]);

  public fetchUser() {
    return this.http
      .get<{ athlete_id: number; firstname: string }>(`${this.baseUrl}/strava/me/`)
      .pipe(tap((userData) => this.user.set(userData)));
  }

  public fetchBikes(athleteId: number) {
    return this.http
      .get<{ bikes: Bike[] }>(`${this.baseUrl}/strava/bikes/${athleteId}/`)
      .pipe(tap((res) => this.bikes.set(res.bikes)));
  }

  public syncAndFetchActivities() {
    return this.http
      .post(`${this.baseUrl}/strava/sync/`, {})
      .pipe(switchMap(() => this.fetchActivities()));
  }

  private fetchActivities() {
    return this.http.get<Activity[]>(`${this.baseUrl}/activities/`).pipe(
      tap((res) => {
        console.log('Empfangene Aktivitäten:', res);
        this.activities.set(res);
      }),
    );
  }

  public logout() {
    this.http.post('http://localhost:8000/api/strava/logout/', {}).subscribe({
      next: (res) => {
        this.router.navigate(['/login']);
      },
      error: (err) => {
        console.error('Logout failed', err);
      },
    });
  }
}
