import { Component } from '@angular/core';

@Component({
  selector: 'app-login',
  imports: [],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private clientId = '249812';
  private redirectUri = 'http://localhost:4200/strava-callback';

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
