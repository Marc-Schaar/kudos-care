import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from './../../../../../environments/environment';

@Component({
  selector: 'app-strava-callback',
  imports: [],
  templateUrl: './strava-callback.html',
  styleUrl: './strava-callback.css',
})
export class StravaCallback {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  status = signal<'loading' | 'success' | 'error'>('loading');
  error = false;
  errorMessage = '';

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      const code = params['code'];
      const error = params['error'];
      const scope = params['scope'];

      if (error) {
        this.status.set('error');
        this.errorMessage = 'Der Zugriff wurde von dir abgelehnt.';
        return;
      }

      if (code) {
        this.exchangeCodeWithBackend(code, scope);
      } else {
        this.status.set('error');
        this.errorMessage = 'Kein Autorisierungs-Code in der URL gefunden.';
      }
    });
  }

  exchangeCodeWithBackend(code: string, scope?: string) {
    const backendUrl = `${this.baseUrl}/strava/auth/`;

    this.http.post<any>(backendUrl, { code: code, scope: scope }).subscribe({
      next: (res) => {
        this.status.set('success');
        setTimeout(() => this.router.navigate(['/dashboard']), 2000);
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
    this.router.navigate(['/connect']);
  }
}
