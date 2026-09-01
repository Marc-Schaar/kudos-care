import { TestBed } from '@angular/core/testing';
import { HttpHeaders, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { firstValueFrom, of } from 'rxjs';

import { csrfInterceptor } from './csrf-interceptor';

function clearCookie() {
  document.cookie = 'csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';
}

describe('csrfInterceptor', () => {
  const interceptor: HttpInterceptorFn = (req, next) =>
    TestBed.runInInjectionContext(() => csrfInterceptor(req, next));

  beforeEach(() => {
    TestBed.configureTestingModule({});
    clearCookie();
  });

  afterEach(() => clearCookie());

  it('setzt den X-CSRFToken-Header aus dem Cookie, auch fuer eine andere Origin', async () => {
    document.cookie = 'csrftoken=abc123';
    const req = new HttpRequest('POST', 'http://localhost:8000/api/maintenance/bikes/1/assemblies/', {});

    let seenHeader: string | null = null;
    await firstValueFrom(
      interceptor(req, (clonedReq) => {
        seenHeader = clonedReq.headers.get('X-CSRFToken');
        return of(new HttpResponse({ status: 200 }));
      }),
    );

    expect(seenHeader).toBe('abc123');
  });

  it('laesst die Anfrage unveraendert, wenn kein Cookie gesetzt ist', async () => {
    const req = new HttpRequest('POST', '/api/maintenance/bikes/1/assemblies/', {});

    let hasHeader: boolean | null = null;
    await firstValueFrom(
      interceptor(req, (clonedReq) => {
        hasHeader = clonedReq.headers.has('X-CSRFToken');
        return of(new HttpResponse({ status: 200 }));
      }),
    );

    expect(hasHeader).toBe(false);
  });

  it('ueberschreibt einen bereits gesetzten Header nicht', async () => {
    document.cookie = 'csrftoken=abc123';
    const req = new HttpRequest(
      'POST',
      '/api/maintenance/bikes/1/assemblies/',
      {},
      { headers: new HttpHeaders({ 'X-CSRFToken': 'already-set' }) },
    );

    let seenHeader: string | null = null;
    await firstValueFrom(
      interceptor(req, (clonedReq) => {
        seenHeader = clonedReq.headers.get('X-CSRFToken');
        return of(new HttpResponse({ status: 200 }));
      }),
    );

    expect(seenHeader).toBe('already-set');
  });
});
