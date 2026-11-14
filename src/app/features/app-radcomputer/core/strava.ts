import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../../../core/interceptors/error-interceptor/error-interceptor';
import {
  STRAVA_SCOPE,
  StravaService,
} from '../../../shared/services/strava-service/strava-service';
import { RADCOMPUTER_GRANT_STATE } from './paths';

/** Fehler zeigt der Radcomputer in seiner eigenen Leiste, nicht als Kudos-Toast. */
const context = (): HttpContext => new HttpContext().set(SKIP_ERROR_TOAST, true);

export interface StravaRoute {
  id: string;
  name: string;
  distance_m: number;
  elevation_m: number;
  ride: boolean;
  private: boolean;
  updated_at: string | null;
}

export interface UploadState {
  id: number | null;
  status: string;
  error: string | null;
  activity_id: number | null;
}

/**
 * Strava im Radcomputer, über die Anmeldung von Kudos Care (Session-Cookie). Die Seite
 * ist durch den authGuard geschützt, angemeldet ist man hier also immer. Die Anmeldung fragt
 * activity:write schon mit an; hat jemand es bei Strava abgewählt, holt `grantUpload()` es nach.
 *
 * Eine hochgeladene Fahrt kommt über den Strava-Webhook automatisch auch in Kudos Care an.
 */
@Injectable({ providedIn: 'root' })
export class Strava {
  private readonly http = inject(HttpClient);
  private readonly kudos = inject(StravaService);
  private readonly api = `${environment.apiUrl}/radcomputer`;

  readonly user = this.kudos.user;
  readonly connected = computed(() => this.user() != null);
  readonly firstname = computed(() => this.user()?.firstname ?? '');
  readonly canUpload = computed(() => this.user()?.can_upload === true);
  readonly privateRoutes = computed(() => this.user()?.private_routes === true);
  readonly busy = signal(false);

  /** Aktualisiert die Rechte, z. B. nach dem Freischalten. */
  check(): void {
    this.kudos.fetchUser().subscribe({ error: () => undefined });
  }

  /** Leitet zu Strava, um Upload und private Routen freizugeben. Zurück geht es über den Kudos-Callback. */
  grantUpload(): void {
    this.busy.set(true);
    const params = new URLSearchParams({
      client_id: String(environment.clientID),
      redirect_uri: `${environment.redirectUrl}/app/strava-callback`,
      response_type: 'code',
      approval_prompt: 'auto',
      scope: STRAVA_SCOPE,
      state: RADCOMPUTER_GRANT_STATE,
    });
    window.location.href = `https://www.strava.com/oauth/authorize?${params}`;
  }

  async upload(form: FormData): Promise<UploadState> {
    return this.request(() =>
      this.http.post<UploadState>(`${this.api}/upload/`, form, { context: context() }),
    );
  }

  async uploadStatus(id: number): Promise<UploadState> {
    return this.request(() =>
      this.http.get<UploadState>(`${this.api}/upload/${id}/`, { context: context() }),
    );
  }

  async routes(page = 1): Promise<{ routes: StravaRoute[]; more: boolean }> {
    return this.request(() =>
      this.http.get<{ routes: StravaRoute[]; more: boolean }>(`${this.api}/routes/`, {
        params: { page },
        context: context(),
      }),
    );
  }

  async routeGpx(id: string): Promise<string> {
    return this.request(() =>
      this.http.get(`${this.api}/routes/${id}/gpx/`, { responseType: 'text', context: context() }),
    );
  }

  private async request<T>(call: () => Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(call());
    } catch (err) {
      throw new Error(this.message(err));
    }
  }

  /** Klartext für die Anzeige. */
  private message(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body =
        typeof err.error === 'object' && err.error
          ? (err.error as { detail?: string; code?: string })
          : null;
      if (err.status === 0) return 'Keine Verbindung zu Kudos Care. Netz prüfen.';
      if (body?.code === 'scope_missing') {
        this.check();
        return 'Upload noch nicht freigeschaltet. Unter Einstellungen bei Strava freigeben.';
      }
      if (err.status === 401 || err.status === 403)
        return body?.detail ?? 'Bitte bei Kudos Care neu anmelden.';
      return body?.detail ?? `Anfrage fehlgeschlagen (HTTP ${err.status}).`;
    }
    return err instanceof Error ? err.message : 'Anfrage fehlgeschlagen.';
  }
}
