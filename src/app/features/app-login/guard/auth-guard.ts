// src/app/auth.guard.ts
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { NavigationService } from '../../../shared/services/navigation-service/navigation-service';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { StravaService } from '../../../shared/services/strava-service/strava-service';

export const authGuard = () => {
  const stravaService = inject(StravaService);
  const router = inject(Router);
  const nav = inject(NavigationService);

  if (stravaService.user() !== null) {
    return true;
  }

  return stravaService.fetchUser().pipe(
    map(() => true),
    // createUrlTree statt navigate: ein Guard gibt das Ziel zurueck, er springt
    // nicht selbst. Der Pfad kommt trotzdem aus dem Navigations-Service.
    catchError(() => of(router.createUrlTree(nav.to.login()))),
  );
};
