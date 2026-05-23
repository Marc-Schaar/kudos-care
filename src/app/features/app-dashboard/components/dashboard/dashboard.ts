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

  ngOnInit() {
    this.stravaService.fetchUser().subscribe({
      next: (user) => this.stravaService.fetchBikes(user.athlete_id).subscribe(),
      error: () => this.router.navigate(['/login']),
    });
  }

  public logout() {
    this.stravaService.logout();
  }
}
