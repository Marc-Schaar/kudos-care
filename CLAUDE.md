# Project: Kudos Care — Frontend (Angular)

## Was ist Kudos Care?

Wartungs-Tracking-App für Fahrräder/Motorräder mit Strava-Integration. Login via
Strava-OAuth, Sync von Aktivitäten/Bikes, Verschleiß-Tracking von Bike-Komponenten
(Status `ok`/`warn`/`critical`/`unknown`). UI-Sprache ist **Deutsch**
(`LOCALE_ID: 'de'`, deutsche Fehlermeldungen/Toasts). Zugehöriges Backend:
`kudos_care_backend` (Django/DRF), Port 8000 in Dev, siehe dessen `claude.md`.

## Tech Stack

- **Angular 21.2**, esbuild-basierter Builder (`@angular/build:application`), **keine
  NgModules** — durchgehend Standalone Components.
- **Tailwind CSS v4** via `@tailwindcss/postcss` (`.postcssrc.json`), importiert in
  `src/styles.css`. Dark Theme als Default, `prefers-color-scheme: light` Override.
  Custom CSS-Variablen für Warn-Status-Farben (`--ok`/`--warn`/`--critical`).
- Kein UI-Framework (kein Material/PrimeNG) — Komponenten sind handgebaut.
- **State Management**: Signals in `providedIn:'root'`-Services (kein NgRx/Akita). RxJS
  bleibt Transport-/Async-Layer für HTTP-Calls und Timer (siehe unten).
- **Testing**: **Vitest** (`@angular/build:unit-test`), nicht Karma/Jasmine.
- Weitere Deps: `chart.js`, `maplibre-gl` (+ `@types/maplibre-gl`) für Activity-Maps,
  `rxjs ~7.8`.
- TypeScript strict mode voll aktiv (`strict`, `noImplicitOverride`, `strictTemplates`, ...).
- Prettier: `printWidth: 100`, single quotes, Angular-HTML-Parser-Override (`.prettierrc`).

## Commands

- Dev Server: `npm start` (→ `ng serve`, Port 4200)
- Build: `npm run build` (Production-Config, Budgets 500kB/1MB initial,
  `anyComponentStyle` 10kB warn / 16kB error — hochgesetzt wegen der animationslastigen
  `app-landing`-Stylesheet)
- Watch-Build: `npm run watch`
- Tests: `npm test` (Vitest via `ng test`)

## Projektstruktur (`src/app/`)

```
core/                          — Shell, Bootstrapping, Routing, Interceptors
  app.ts / app.config.ts       — Root-Component, ApplicationConfig (Router, HttpClient, Locale)
  app.routes.ts                — Top-Level-Routen
  maintenances.routes.ts       — Lazy Child-Routes für /maintenance
  interceptors/
    auth-interceptor/          — setzt withCredentials: true auf jeden Request
    error-interceptor/         — globaler HTTP-Error-Handler → NotificationService-Toast

features/
  app-landing/                  — Öffentliche Marketing-Landing-Page (`/landingpage`, lazy,
    kein authGuard). Scroll-gekoppelte CSS-Animation (drehende Kurbel + Kette, 3D-Tilt)
    über ein Signal + rAF-Scroll-Listener, Einblendungen via IntersectionObserver.
  app-login/                   — Login, Strava-OAuth-Callback, authGuard.
    login.html verlinkt auf `/landingpage`.
  app-dashboard/                — Landing-Page nach Login (Bikes-Übersicht, Sync, Activities)
  app-activity/                 — Strava Activity List/Detail, Map, Wetter-Overlay
    pipes/headwind-label, services/activity-service
  app-maintenance/               — Kern-Domäne: Bikes → Baugruppen → Elemente, Verschleiß
    services/bike-service, pipes/(km, warn-class, warn-label)
    models/maintenance.models.ts — BikeList/BikeDetail, BikeAssembly, ComponentGroupCatalog,
                                   MaintenanceInterval, ComponentSlot, BikeComponent, ...
    Ein Bike besteht aus Baugruppen (`BikeAssembly`). `detail-bike-component` lädt
    `GET bikes/<id>/assemblies/` und rendert je Baugruppe eine `assembly-card-component`
    (Kopfzeile trägt Name, Setup-km, Gesamt-Status und den **"Baugruppe tauschen"**-Button;
    Body = `slot-card-component`-Elementzeilen mit echtem km-/Tage-Balken +
    `interval-row-component` für Verbrauchsmaterial mit "Erledigt"-Button).
    Anlegen: `add-assembly-dialog-component` (Gruppe wählen → `assembly-checklist-component`).
    Neues Bike ohne Komponenten → `bike-setup-stepper-component` (ein Schritt je empfohlener
    Baugruppe). `quick-change-dialog-component` = "Baugruppe tauschen" (→ `assemblies/<id>/swap/`).
    Einzelteil weiter über `add-component-dialog-component` / `component-swap-dialog-component`.

shared/
  components/notification-component — Toast-UI (liest NotificationService-Signal)
  components/skeleton                — Loading-Skeleton (variant: block/row/bar, count, height/width)
  pipes/abs
  services/notification-service, strava-service
```

Jedes `app-*`-Feature hat eigene `components/`, `models/`, `services/`, `pipes/` —
self-contained, obwohl es keine NgModules gibt.

**Naming-Inkonsistenz (bekannt, nicht kritisch):** ältere `app-maintenance`-Komponenten
haben Ordner+Klasse mit `*Component`-Suffix (`SlotCardComponent`), neuere Features nicht
(`Dashboard`, `Login`, `ActivityList`). Bei neuem Code: kein `Component`-Suffix verwenden,
Konsistenz zu neueren Features halten.

## Routing (`core/app.routes.ts`, `maintenances.routes.ts`)

- `''` → redirect `login`
- `login`, `strava-callback` → eager, ungeschützt
- `landingpage` → lazy (`loadComponent`), ungeschützt (öffentliche Landing-Page)
- `dashboard` → eager, `authGuard`
- `activities`, `activity/:id` → lazy (`loadComponent`), `authGuard`
- `maintenance` → `loadChildren` → `MAINTENANCE_ROUTES` (`''` = Bike-Liste,
  `bikes/:id` = Bike-Detail). **Achtung:** Parent-Route selbst ist nicht mit `authGuard`
  versehen — vor Änderungen an Maintenance-Routing prüfen, ob das beabsichtigt ist.

## API-Kommunikation & Auth

- Base-URL aus `src/environments/environment.ts` (dev: `http://localhost:8000/api`) bzw.
  `environment.prod.ts` (`/api`, same-origin via Nginx-Reverse-Proxy). Kein zentraler
  `ApiService` — jeder Feature-Service (`StravaService`, `BikeService`, `ActivityService`)
  injiziert `HttpClient` direkt.
- **Session-Cookie-Auth, kein JWT.** `provideHttpClient` nutzt
  `withXsrfConfiguration({cookieName:'csrftoken', headerName:'X-CSRFToken'})` (Django-CSRF-
  Konvention). `authInterceptor` setzt nur `withCredentials: true` — keine Token-Logik.
  **Beim Debuggen von Auth-Problemen niemals einen `Authorization`-Header vorschlagen.**
- Login: `Login`-Component baut Strava-Authorize-URL client-seitig und redirected per
  `window.location.href`. `StravaCallback` liest `code`/`scope`/`error` aus Query-Params,
  postet an `${apiUrl}/strava/auth/`, setzt `StravaService.user`-Signal, navigiert nach
  2s Delay zu `/dashboard`.
- `authGuard` (`features/app-login/guard/auth-guard.ts`): wenn `stravaService.user()`
  gesetzt ist → erlaubt; sonst `GET /strava/me/` (via Session-Cookie), Erfolg → erlaubt,
  Fehler → Redirect `/login`.
- `errorInterceptor` fängt alle `HttpErrorResponse`s global ab, zeigt deutschen Toast via
  `NotificationService`, wirft danach weiter.

## State Management

Signal-basierte Root-Services sind der durchgängige Pattern:
- `StravaService.user/activities/syncing`, `BikeService.bikes/selectedBike/selectedSlot/templates`,
  `ActivityService.activityData`, `NotificationService.notification`.
- Components lesen Signals direkt in Templates, nutzen `computed()` (z. B. `Dashboard`:
  `activeBikes`, `criticalCount`, `warnCount`, `totalDistanceKm`, `recentActivities`) und
  `effect()` für Reaktionen auf State-Änderungen.
- HTTP-Calls liefern Observables (`http.get(...).pipe(tap(res => signal.set(res)))`),
  Components `.subscribe()`n meist in `ngOnInit`. RxJS = Transport-Layer, Signals = State-Layer.
- `StravaService` pollt Sync-Status via `interval(3000).pipe(switchMap(...), takeWhile(...))`.

## Bekannte Quirks

- `BikeService` enthält einen großen hardcodierten Mock-Data-Block (`mokedBikes`) hinter
  `private devMode = false`. Toter/Dev-only Code — beim Anfassen von `BikeService` im
  Hinterkopf behalten, ggf. zur Entfernung vorschlagen.
- `environment.ts` (dev) hat `production: true` gesetzt (wirkt wie Copy-Paste-Fehler) —
  der tatsächliche Prod/Dev-Switch läuft über Angular `fileReplacements`, nicht über dieses
  Flag. Vor Verwendung des Flags im Code prüfen, ob das gewollt ist.

## Testing

Vitest, Specs co-located (`*.spec.ts` neben Source), Standard-Angular-CLI-`TestBed`-Pattern.
Viele Specs sind bislang generierte "should be created"-Stubs statt echter
Verhaltenstests — bei neuen Features auf echte Assertions achten, nicht nur Scaffold
übernehmen.

## Deployment

`.github/workflows/deploy.yml`: Push auf `main` → `npm run build -- --configuration
production` → SCP von `dist/kudos-care/browser/*` auf Server → Nginx-Restart. Nginx
reverse-proxied vermutlich `/api` auf das Django-Backend (same-origin, passend zu
`environment.prod.ts`).

---

## Pflege dieser Datei

Diese Datei soll mit dem Projekt mitwachsen. Wenn sich während einer Session etwas als
falsch/veraltet herausstellt, oder ein neues Feature/eine neue Route/ein wichtiges Pattern
hinzukommt, aktualisiere den passenden Abschnitt oben (nicht nur anhängen, sondern die
Doku korrigieren). Keine Secrets, keine Task-spezifischen Details, keine chronologischen
Change-Logs — nur dauerhaft gültiges Architektur-/Konventionswissen.
