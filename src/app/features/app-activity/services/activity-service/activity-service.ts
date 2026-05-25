import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ActivityService {
  private http = inject(HttpClient);
  private baseUrl = 'http://localhost:8000/api';

  public activityData = signal<any>(null);

  public getActivityDetail(id: number) {
    return this.http
      .get<any>(`${this.baseUrl}/activities/${id}/`)
      .pipe(tap((data) => this.activityData.set(data)));
  }
}
