import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { StravaService } from '../../../../shared/services/strava-service/strava-service';
import { NavigationService } from '../../../../shared/services/navigation-service/navigation-service';

@Component({
  selector: 'app-login',
  imports: [RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login implements OnInit {
  private clientId = environment.clientID;
  private redirectUri = environment.redirectUrl + '/strava-callback';
  readonly nav = inject(NavigationService);
  private readonly stravaService = inject(StravaService);

  checking = signal(true);
  devLoginEnabled = environment.devLoginEnabled;

  ngOnInit() {
    this.stravaService.fetchUser().subscribe({
      next: () => this.nav.goTo(this.nav.to.dashboard()),
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

  devLogin() {
    this.stravaService.devLogin().subscribe({
      next: () => this.nav.goTo(this.nav.to.dashboard()),
      error: (err) => console.error('Dev-Login fehlgeschlagen', err),
    });
  }
}
