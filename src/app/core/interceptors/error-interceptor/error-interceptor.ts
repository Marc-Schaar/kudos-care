import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { NotificationService } from '../../../shared/services/notification-service/notification-service';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const service = inject(NotificationService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const msg = err.error.message || 'Ein Fehler ist aufgetreten';
      service.show(msg, 'error');
      return throwError(() => err);
    }),
  );
};
