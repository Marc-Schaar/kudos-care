import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { StravaService } from '../../../../shared/services/strava-service/strava-service';

@Component({
  selector: 'app-login',
  imports: [],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login implements OnInit {
  private clientId = environment.clientID;
  private redirectUri = environment.redirectUrl + '/strava-callback';
  private readonly stravaService = inject(StravaService);
  private readonly router = inject(Router);

  checking = signal(true);

  ngOnInit() {
    this.stravaService.fetchUser().subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: () => this.checking.set(false),
    });
  }

  connectWithStrava() {
    const stravaAuthUrl =
      `https://www.strava.com/oauth/authorize?` +
      `client_id=${this.clientId}` +
      `&redirect_uri=${encodeURIComponent(this.redirectUri)}` +
      `&response_type=code` +
      `&scope=profile:read_all,activity:read_all`;

    window.location.href = stravaAuthUrl;
  }
}
