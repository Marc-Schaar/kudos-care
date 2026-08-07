import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { StravaService } from '../../../../shared/services/strava-service/strava-service';
import { Skeleton } from '../../../../shared/components/skeleton/skeleton';

@Component({
  selector: 'app-activity-list',
  imports: [RouterLink, DatePipe, DecimalPipe, Skeleton],
  templateUrl: './activity-list.html',
  styleUrl: './activity-list.css',
})
export class ActivityList implements OnInit {
  private stravaService = inject(StravaService);

  public loading = signal(true);

  public activities = computed(() =>
    [...this.stravaService.activities()].sort(
      (a, b) => Date.parse(b.start_date ?? '') - Date.parse(a.start_date ?? ''),
    ),
  );

  ngOnInit() {
    this.loading.set(true);
    this.stravaService.fetchActivities().subscribe({
      complete: () => this.loading.set(false),
      error: () => this.loading.set(false),
    });
  }

  public formatDuration(seconds: number | null): string {
    if (!seconds) return '–';
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    if (h === 0) return `${m} min`;
    return `${h} h ${m.toString().padStart(2, '0')} min`;
  }
}
