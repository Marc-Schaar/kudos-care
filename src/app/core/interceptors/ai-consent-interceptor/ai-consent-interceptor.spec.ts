import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AiConsentService } from '../../../shared/services/ai-consent-service/ai-consent-service';
import { aiConsentInterceptor } from './ai-consent-interceptor';

describe('aiConsentInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let consent: AiConsentService;
  const refuse = { error: 'x', code: 'ai_consent_required' };
  const forbidden = { status: 403, statusText: 'Forbidden' };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([aiConsentInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    consent = TestBed.inject(AiConsentService);
  });

  it('fragt nach und wiederholt die Anfrage bei Zustimmung', () => {
    let body: unknown;
    http.get('/ki').subscribe((res) => (body = res));
    backend.expectOne('/ki').flush(refuse, forbidden);
    expect(consent.asking()).toBe(true);

    consent.answer(true);

    backend.expectOne('/ki').flush({ text: 'ok' });
    expect(body).toEqual({ text: 'ok' });
    expect(consent.asking()).toBe(false);
  });

  it('gibt den Fehler bei Ablehnung weiter und schickt nichts erneut', () => {
    let status = 0;
    http.get('/ki').subscribe({ error: (err) => (status = err.status) });
    backend.expectOne('/ki').flush(refuse, forbidden);

    consent.answer(false);

    backend.expectNone('/ki');
    expect(status).toBe(403);
  });

  it('fragt bei gleichzeitigen Anfragen nur einmal', () => {
    let done = 0;
    http.get('/a').subscribe(() => done++);
    http.get('/b').subscribe(() => done++);
    backend.expectOne('/a').flush(refuse, forbidden);
    backend.expectOne('/b').flush(refuse, forbidden);

    consent.answer(true);

    backend.expectOne('/a').flush({});
    backend.expectOne('/b').flush({});
    expect(done).toBe(2);
  });

  it('lässt andere 403-Antworten unberührt', () => {
    let status = 0;
    http.get('/x').subscribe({ error: (err) => (status = err.status) });
    backend.expectOne('/x').flush({ code: 'other' }, forbidden);
    expect(status).toBe(403);
    expect(consent.asking()).toBe(false);
  });
});
