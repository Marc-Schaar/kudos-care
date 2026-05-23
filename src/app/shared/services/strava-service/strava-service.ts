import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';

export interface Bike {
  id: string;
  name: string;
  distance: number;
  primary: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class StravaService {
  private http = inject(HttpClient);
  private baseUrl = 'http://localhost:8000/api/strava';
  private router = inject(Router);

  user = signal<{ athlete_id: number; firstname: string } | null>(null);
  bikes = signal<Bike[]>([]);

  fetchUser() {
    return this.http
      .get<{ athlete_id: number; firstname: string }>(`${this.baseUrl}/me/`)
      .pipe(tap((userData) => this.user.set(userData)));
  }

  fetchBikes(athleteId: number) {
    return this.http
      .get<{ bikes: Bike[] }>(`${this.baseUrl}/bikes/${athleteId}/`)
      .pipe(tap((res) => this.bikes.set(res.bikes)));
  }

  // dashboard.ts
  logout() {
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
