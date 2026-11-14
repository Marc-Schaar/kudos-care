import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { NotificationService } from '../../../shared/services/notification-service/notification-service';
import { catchError, throwError } from 'rxjs';

/**
 * Für Bereiche mit eigener Meldungsleiste (Radcomputer): Die Anfrage zeigt ihren Fehler
 * selbst an, der globale Toast würde ihn nur doppelt bringen.
 */
export const SKIP_ERROR_TOAST = new HttpContextToken<boolean>(() => false);

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const service = inject(NotificationService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (req.context.get(SKIP_ERROR_TOAST)) return throwError(() => err);
      // DRF liefert Feldfehler als { feld: ["Meldung"] } — die erste davon ist die Aussage.
      const fieldError = Object.values(err.error ?? {}).find(Array.isArray)?.[0];
      const msg =
        err.error?.message ||
        err.error?.detail ||
        err.error?.error ||
        fieldError ||
        'Ein Fehler ist aufgetreten';
      service.show(msg, 'error');
      return throwError(() => err);
    }),
  );
};
