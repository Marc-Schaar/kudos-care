import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AiConsentService } from '../../../shared/services/ai-consent-service/ai-consent-service';

/**
 * Antwortet das Backend mit `ai_consent_required`, fragt die App einmal nach und schickt dieselbe
 * Anfrage bei Zustimmung erneut. So kennt keine der KI-Aufrufstellen die Einwilligung. Steht in
 * `app.config.ts` hinter dem `errorInterceptor`, damit die Rückfrage keinen Fehler-Toast auslöst.
 */
export const aiConsentInterceptor: HttpInterceptorFn = (req, next) => {
  const consent = inject(AiConsentService);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (
        !(err instanceof HttpErrorResponse) ||
        err.status !== 403 ||
        err.error?.code !== 'ai_consent_required'
      ) {
        return throwError(() => err);
      }
      return consent
        .ask()
        .pipe(switchMap((granted) => (granted ? next(req) : throwError(() => err))));
    }),
  );
};
