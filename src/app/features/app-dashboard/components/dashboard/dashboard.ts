import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { StravaService } from '../../../../shared/services/strava-service/strava-service';
import { BikeService } from '../../../app-maintenance/services/bike-service/bike-service';
import { WarnClassPipe } from '../../../app-maintenance/pipes/warn-class/warn-class-pipe';
import { WarnLabelPipe } from '../../../app-maintenance/pipes/warn-label/warn-label-pipe';
import { BikeList, WarnStatus } from '../../../app-maintenance/models/maintenance.models';
import { Skeleton } from '../../../../shared/components/skeleton/skeleton';
import { UserMenu } from '../../../../shared/components/user-menu/user-menu';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, DatePipe, DecimalPipe, WarnClassPipe, WarnLabelPipe, Skeleton, UserMenu],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  private stravaService = inject(StravaService);
  private bikeService = inject(BikeService);
  private router = inject(Router);

  public user = this.stravaService.user;
  public bikes = this.bikeService.bikes;
  public activities = this.stravaService.activities;
  public syncing = this.stravaService.syncing;
  public syncProgress = this.stravaService.syncProgress;

  public loading = signal(true);

  private wasSyncing = false;

  public activeBikes = computed(() => this.bikes().filter((b) => !b.retired));

  public criticalCount = computed(
    () => this.activeBikes().filter((b) => b.warn_status === 'critical').length,
  );
  public warnCount = computed(
    () => this.activeBikes().filter((b) => b.warn_status === 'warn').length,
  );

  public totalDistanceKm = computed(() =>
    this.activeBikes().reduce((sum, b) => sum + (b.total_distance_km ?? 0), 0),
  );

  public recentActivities = computed(() =>
    [...this.activities()]
      .sort((a, b) => Date.parse(b.start_date ?? '') - Date.parse(a.start_date ?? ''))
      .slice(0, 8),
  );

  constructor() {
    effect(() => {
      const syncing = this.syncing();
      if (this.wasSyncing && !syncing) {
        this.bikeService.fetchBikes().subscribe();
      }
      this.wasSyncing = syncing;
    });
  }

  ngOnInit() {
    this.loading.set(true);
    this.bikeService.fetchBikes().subscribe();
    this.stravaService.fetchActivities().subscribe({
      complete: () => this.loading.set(false),
      error: () => this.loading.set(false),
    });
    this.stravaService.checkOngoingSync().subscribe();
  }

  public syncNow() {
    this.stravaService.triggerSync().subscribe();
  }

  public cancelSync() {
    this.stravaService.cancelSync().subscribe();
  }

  public cardClass(bike: BikeList): string {
    const map: Record<WarnStatus, string> = {
      critical: 'card-critical',
      warn: 'card-warn',
      ok: 'card-ok',
      unknown: 'card-unknown',
    };
    return `bike-card ${map[bike.warn_status] ?? 'card-unknown'}`;
  }

  public formatDuration(seconds: number | null): string {
    if (!seconds) return '–';
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    if (h === 0) return `${m} min`;
    return `${h} h ${m.toString().padStart(2, '0')} min`;
  }

  public goToActivity(activityId: number) {
    this.router.navigate(['/activity', activityId]);
  }

  public goToMaintenance() {
    this.router.navigate(['/maintenance']);
  }

  public logout() {
    this.stravaService.logout();
  }
}
