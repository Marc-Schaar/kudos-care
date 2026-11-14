import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from './../../../../../environments/environment';
import { StravaService } from '../../../../shared/services/strava-service/strava-service';
import { Skeleton } from '../../../../shared/components/skeleton/skeleton';
import { NavigationService } from '../../../../shared/services/navigation-service/navigation-service';

import { WEATHER_CONSENT_STATE } from '../login/login';
import { RADCOMPUTER_GRANT_STATE } from '../../../app-radcomputer/core/paths';

@Component({
  selector: 'app-strava-callback',
  imports: [Skeleton],
  templateUrl: './strava-callback.html',
  styleUrl: './strava-callback.css',
})
export class StravaCallback {
  readonly nav = inject(NavigationService);
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private stravaService = inject(StravaService);
  private baseUrl = environment.apiUrl;

  status = signal<'loading' | 'success' | 'error'>('loading');
  private backToRadcomputer = false;
  error = false;
  errorMessage = '';

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      const code = params['code'];
      const error = params['error'];
      const scope = params['scope'];
      const weatherConsent = params['state'] === WEATHER_CONSENT_STATE;
      // Zurück aus „Upload freischalten“ im Radcomputer: danach wieder dorthin.
      this.backToRadcomputer = params['state'] === RADCOMPUTER_GRANT_STATE;

      if (error) {
        this.status.set('error');
        this.errorMessage = 'Der Zugriff wurde von dir abgelehnt.';
        return;
      }

      if (code) {
        this.exchangeCodeWithBackend(code, scope, weatherConsent);
      } else {
        this.status.set('error');
        this.errorMessage = 'Kein Autorisierungs-Code in der URL gefunden.';
      }
    });
  }

  exchangeCodeWithBackend(code: string, scope?: string, weatherConsent = false) {
    const backendUrl = `${this.baseUrl}/strava/auth/`;

    this.http
      .post<any>(backendUrl, { code: code, scope: scope, weather_consent: weatherConsent })
      .subscribe({
        next: (res) => {
          this.status.set('success');
          if (res?.athlete) {
            this.stravaService.setLoggedInUser(res.athlete.id, res.athlete.firstname);
          }
          const next = this.backToRadcomputer ? this.nav.to.radcomputer() : this.nav.to.dashboard();
          setTimeout(() => this.nav.goTo(next), 2000);
        },
        error: (err) => {
          this.status.set('error');
          if (err.error?.error === 'scope_insufficient') {
            this.errorMessage =
              'Bitte erlaube beim Verbinden mit Strava auch den Zugriff auf private Aktivitäten.';
          } else {
            this.errorMessage = 'Dein Server konnte den Code nicht bei Strava verifizieren.';
          }
          console.error(err);
        },
      });
  }

  retry() {
    this.nav.goTo(this.nav.to.login());
  }
}
