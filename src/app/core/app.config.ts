import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import { authInterceptor } from './interceptors/auth-interceptor/auth-interceptor';
import { csrfInterceptor } from './interceptors/csrf-interceptor/csrf-interceptor';
import { errorInterceptor } from './interceptors/error-interceptor/error-interceptor';
import { LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';

registerLocaleData(localeDe);

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: LOCALE_ID, useValue: 'de' },
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([authInterceptor, csrfInterceptor, errorInterceptor]),
      // Deckt nur den Fall ab, dass Request- und Seiten-Origin identisch sind
      // (Produktion, siehe environment.prod.ts: apiUrl ist relativ). Im
      // lokalen Dev-Betrieb (Frontend/Backend auf verschiedenen Ports) greift
      // stattdessen csrfInterceptor — siehe dessen Kommentar für Details.
      withXsrfConfiguration({
        cookieName: 'csrftoken',
        headerName: 'X-CSRFToken',
      }),
    ),
  ],
};
