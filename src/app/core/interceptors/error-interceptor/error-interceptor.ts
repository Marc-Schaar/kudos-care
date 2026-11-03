import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { NotificationService } from '../../../shared/services/notification-service/notification-service';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const service = inject(NotificationService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
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
