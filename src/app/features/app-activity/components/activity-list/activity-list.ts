import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Skeleton } from '../../../../shared/components/skeleton/skeleton';
import { StravaService } from '../../../../shared/services/strava-service/strava-service';
import { groupByMonth } from '../../models/ride-insights';
import { RideRow } from '../ride-row/ride-row';
import { RideTally } from '../ride-tally/ride-tally';

/** Alle Fahrten: oben die Strichliste der letzten Monate, darunter nach Monaten gegliedert. */
@Component({
  selector: 'app-activity-list',
  imports: [DecimalPipe, RideRow, RideTally, Skeleton],
  templateUrl: './activity-list.html',
  styleUrl: './activity-list.css',
})
export class ActivityList implements OnInit {
  private stravaService = inject(StravaService);

  public loading = signal(true);
  public activities = this.stravaService.activities;
  public months = computed(() => groupByMonth(this.activities()));

  ngOnInit() {
    this.loading.set(true);
    this.stravaService.fetchActivities().subscribe({
      complete: () => this.loading.set(false),
      error: () => this.loading.set(false),
    });
  }
}
