import { TestBed } from '@angular/core/testing';
import { HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { firstValueFrom, of } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { authInterceptor } from './auth-interceptor';

describe('authInterceptor', () => {
  const interceptor: HttpInterceptorFn = (req, next) =>
    TestBed.runInInjectionContext(() => authInterceptor(req, next));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  async function credentialsFor(url: string): Promise<boolean> {
    let seen = false;
    await firstValueFrom(
      interceptor(new HttpRequest('GET', url), (req) => {
        seen = req.withCredentials;
        return of(new HttpResponse({ status: 200 }));
      }),
    );
    return seen;
  }

  it('schickt das Session-Cookie an die eigene API', async () => {
    expect(await credentialsFor(`${environment.apiUrl}/strava/me/`)).toBe(true);
  });

  // Regressionstest: Mit Cookies lehnt der Browser Antworten mit
  // `Access-Control-Allow-Origin: *` ab, im Radcomputer kam so keine Route zustande.
  it('lässt fremde Dienste ohne Cookie', async () => {
    expect(await credentialsFor('https://brouter.de/brouter?lonlats=1,2%7C3,4')).toBe(false);
    expect(await credentialsFor('https://photon.komoot.io/api/?q=Berlin')).toBe(false);
  });
});
