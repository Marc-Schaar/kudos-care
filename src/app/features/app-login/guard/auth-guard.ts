// src/app/auth.guard.ts
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { StravaService } from '../../../shared/services/strava-service/strava-service';

export const authGuard = () => {
  const stravaService = inject(StravaService);
  const router = inject(Router);

  if (stravaService.user() !== null) {
    return true;
  }

  return stravaService.fetchUser().pipe(
    map(() => true),
    catchError(() => of(router.createUrlTree(['/login']))),
  );
};
