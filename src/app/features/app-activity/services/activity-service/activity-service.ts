import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import { ActivityDetailModel } from '../../models/activity-detail-model';
import { environment } from './../../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ActivityService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  public activityData = signal<ActivityDetailModel | null>(null);

  public getActivityDetail(id: number) {
    return this.http
      .get<ActivityDetailModel>(`${this.baseUrl}/activities/${id}/`)
      .pipe(tap((data) => this.activityData.set(data)));
  }
}
