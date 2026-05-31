import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { StravaService } from '../../../../shared/services/strava-service/strava-service';

@Component({
  selector: 'app-dashboard',
  imports: [],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  private stravaService = inject(StravaService);
  private router = inject(Router);

  user = this.stravaService.user;
  bikes = this.stravaService.bikes;
  activities = this.stravaService.activities;

  ngOnInit() {
    this.stravaService.fetchUser().subscribe({
      next: (user) => {
        (this.stravaService.syncDataBase().subscribe(),
          this.stravaService.fetchActivities().subscribe());
      },
      error: () => this.router.navigate(['/login']),
    });
  }

  public goToActivity(activityId: number) {
    this.router.navigate(['/activity', activityId]);
  }

  public goToBike(bikeId: number) {
    this.router.navigate(['/maintenance/bikes', bikeId]);
  }

  public goToMaintenance() {
    this.router.navigate(['/maintenance']);
  }

  public logout() {
    this.stravaService.logout();
  }
}
