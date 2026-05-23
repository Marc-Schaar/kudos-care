import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

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

  status = signal<'loading' | 'success' | 'error'>('loading');
  error = false;
  errorMessage = '';

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      const code = params['code'];
      const error = params['error'];

      if (error) {
        this.status.set('error');
        this.errorMessage = 'Der Zugriff wurde von dir abgelehnt.';
        return;
      }

      if (code) {
        this.exchangeCodeWithBackend(code);
      } else {
        this.status.set('error');
        this.errorMessage = 'Kein Autorisierungs-Code in der URL gefunden.';
      }
    });
  }

  exchangeCodeWithBackend(code: string) {
    const backendUrl = 'http://localhost:8000/api/strava/auth/';

    this.http.post<any>(backendUrl, { code: code }).subscribe({
      next: (res) => {
        this.status.set('success');
        setTimeout(() => this.router.navigate(['/dashboard']), 2000);
      },
      error: (err) => {
        this.status.set('error');
        this.errorMessage = 'Dein Server konnte den Code nicht bei Strava verifizieren.';
        console.error(err);
      },
    });
  }

  retry() {
    this.router.navigate(['/connect']);
  }
}
