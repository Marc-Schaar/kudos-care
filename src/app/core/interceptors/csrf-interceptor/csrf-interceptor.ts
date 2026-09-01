import { HttpInterceptorFn } from '@angular/common/http';

const COOKIE_NAME = 'csrftoken';
const HEADER_NAME = 'X-CSRFToken';

/**
 * Haengt Djangos CSRF-Header manuell an jede state-changing Anfrage an.
 *
 * Angulars eingebauter Mechanismus (`withXsrfConfiguration` in app.config.ts)
 * bleibt zusaetzlich aktiv und deckt Produktion ab, wo `environment.apiUrl`
 * relativ ist (`/api`) und Frontend+Backend daher dieselbe Origin teilen. Im
 * lokalen Dev-Betrieb ist `apiUrl` dagegen absolut (`http://localhost:8000/api`,
 * siehe environment.ts) — andere Origin als die Angular-App (typischerweise
 * `http://localhost:4200`). Angulars `HttpXsrfInterceptor` haengt den Header
 * laut eigener Quelle (`_module-chunk.mjs`, `xsrfInterceptorFn`) NUR an, wenn
 * `new URL(req.url).origin === new URL(location.href).origin` gilt — bei
 * unterschiedlicher Origin bricht er sang- und klanglos ab, ohne Fehler. Jeder
 * POST/PATCH/DELETE scheiterte dadurch im lokalen Dev-Betrieb an Djangos
 * CSRF-Pruefung ("CSRF token missing"), obwohl das `csrftoken`-Cookie (nicht
 * HttpOnly, siehe `CSRF_COOKIE_HTTPONLY=False` im Backend) im Browser lag und
 * per `document.cookie` lesbar war.
 *
 * Dieser Interceptor liest das Cookie deshalb selbst und setzt den Header
 * unabhaengig von der Origin — das ist genau das von Django empfohlene Muster
 * für eine von der API getrennt gehostete SPA.
 */
export const csrfInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.headers.has(HEADER_NAME)) {
    return next(req);
  }
  const token = readCookie(COOKIE_NAME);
  if (!token) {
    return next(req);
  }
  return next(req.clone({ headers: req.headers.set(HEADER_NAME, token) }));
};

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
