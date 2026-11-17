import { environment } from '../../../environments/environment';

/**
 * Geht die Anfrage an das eigene Backend? Nur dorthin gehören Session-Cookie und
 * CSRF-Token.
 *
 * Vorher hängten `authInterceptor` und `csrfInterceptor` beides an jede Anfrage, auch an
 * fremde Dienste (Routing, Adresssuche im Radcomputer). Deren Antwort trägt
 * `Access-Control-Allow-Origin: *`, und das lehnt der Browser für Anfragen mit Cookies ab;
 * der zusätzliche `X-CSRFToken`-Header erzwang außerdem einen Preflight, den BRouter gar
 * nicht beantwortet. Folge: Im Radcomputer kam keine einzige Route zustande, und das
 * CSRF-Token ging an Dritte.
 */
export function isApiRequest(url: string): boolean {
  const base = typeof location === 'undefined' ? 'http://localhost/' : location.href;
  try {
    const api = new URL(environment.apiUrl, base);
    const target = new URL(url, base);
    const prefix = api.pathname.replace(/\/+$/, '');
    return (
      target.origin === api.origin &&
      (target.pathname === prefix || target.pathname.startsWith(`${prefix}/`))
    );
  } catch {
    return false;
  }
}
