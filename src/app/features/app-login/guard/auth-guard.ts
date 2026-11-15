// src/app/auth.guard.ts
import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { NavigationService } from '../../../shared/services/navigation-service/navigation-service';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { StravaService } from '../../../shared/services/strava-service/strava-service';

// Die Argumente sind optional, damit der Guard im Test auch ohne Router-Zustand läuft.
export const authGuard = (_route?: ActivatedRouteSnapshot, state?: RouterStateSnapshot) => {
  const stravaService = inject(StravaService);
  const router = inject(Router);
  const nav = inject(NavigationService);

  if (stravaService.user() !== null) {
    return true;
  }

  return stravaService.fetchUser().pipe(
    map(() => true),
    // createUrlTree statt navigate: ein Guard gibt das Ziel zurueck, er springt
    // nicht selbst. Das Ziel wird gemerkt, damit der Login danach dorthin zurückführt
    // (z.B. das Rad aus der Warn-Mail).
    catchError(() => {
      nav.rememberReturnUrl(state?.url);
      return of(router.createUrlTree(nav.to.login()));
    }),
  );
};
