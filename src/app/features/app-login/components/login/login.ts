import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import {
  STRAVA_SCOPE,
  StravaService,
} from '../../../../shared/services/strava-service/strava-service';
import { NavigationService } from '../../../../shared/services/navigation-service/navigation-service';

export const WEATHER_CONSENT_STATE = 'weather_consent';

@Component({
  selector: 'app-login',
  imports: [RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login implements OnInit {
  private clientId = environment.clientID;
  private redirectUri = environment.redirectUrl + '/app/strava-callback';
  readonly nav = inject(NavigationService);
  private readonly stravaService = inject(StravaService);

  checking = signal(true);
  /** Bewusst nicht vorausgewählt: eine Einwilligung muss eine aktive Handlung sein. */
  weatherConsent = signal(false);
  devLoginEnabled = environment.devLoginEnabled;

  ngOnInit() {
    this.stravaService.fetchUser().subscribe({
      next: () => this.nav.goToAfterLogin(),
      error: () => this.checking.set(false),
    });
  }

  connectWithStrava() {
    const stravaAuthUrl =
      `https://www.strava.com/oauth/authorize?` +
      `client_id=${this.clientId}` +
      `&redirect_uri=${encodeURIComponent(this.redirectUri)}` +
      `&response_type=code` +
      `&scope=${STRAVA_SCOPE}`;

    // Über \`state\` übersteht die Antwort den Weg über Strava, auch beim Wechsel in die Strava-App.
    const stravaAuthUrlWithConsent = this.weatherConsent()
      ? `${stravaAuthUrl}&state=${WEATHER_CONSENT_STATE}`
      : stravaAuthUrl;

    window.location.href = stravaAuthUrlWithConsent;
  }

  devLogin() {
    this.stravaService.devLogin().subscribe({
      next: () => this.nav.goToAfterLogin(),
      error: (err) => console.error('Dev-Login fehlgeschlagen', err),
    });
  }
}
