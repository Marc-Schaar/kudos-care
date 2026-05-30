import { Component } from '@angular/core';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-login',
  imports: [],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private clientId = '249812';
  private redirectUri = environment.apiUrl + '/strava-callback';

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
