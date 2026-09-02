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
    csrf-interceptor/          — haengt X-CSRFToken manuell an, origin-unabhaengig
                                  (siehe Auth-Abschnitt unten — Angulars eingebauter
                                  Mechanismus reicht im lokalen Dev-Betrieb NICHT)
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
    Die Karte (`components/map`) rendert die **fertigen `wind_segments` vom Backend**
    und interpoliert selbst nichts mehr. Früher schnitt sie den vereinfachten Track in
    Segmente und verteilte die Stundenwerte über den Segment-Index — das war falsch,
    weil RDP in Kurven viele und auf Geraden wenige Punkte behält. Chart, Karte und
    Kopfzeilen-Ø teilen sich jetzt eine relative Farbskala (`maxAbsHeadwind`/
    `maxPrecipitation` aus `activity-detail`), womit auch die Legende endlich stimmt.
    `wind_source` steuert den Hinweis darunter: `coarse` = grobe Start-Ziel-Schätzung,
    `none` = keine Winddaten, Route neutral (Normalfall vor dem `recompute_wind`-Backfill).
    Karte „Was diese Fahrt gekostet hat" = `GET activities/<id>/wear-impact/`.
  app-maintenance/               — Kern-Domäne: Bikes → Baugruppen → Elemente, Verschleiß
    services/bike-service, pipes/(km, warn-class, warn-label)
    models/maintenance.models.ts — BikeList/BikeDetail, BikeAssembly, ComponentGroupCatalog,
                                   MaintenanceInterval, ComponentSlot, BikeComponent, ...
    **Der Wartungsbereich ist mobile first gebaut**: Basis-CSS gilt für schmale Screens,
    breitere bekommen Ausnahmen per `min-width` (nicht umgekehrt). Trefferflächen ≥ 44 px,
    Eingabefelder mit `font-size: 16px`, damit iOS beim Fokus nicht hineinzoomt.
    Die Navigationsleiste liegt **nicht** hier, sondern global in der App-Shell (siehe
    `shared/components/main-nav`).
    Ein Bike hat **zwei Seiten**, bewusst getrennt nach "ansehen" und "ändern":
    `bike-condition-page` (`bikes/:id`) zeigt nur den Zustand — Statistik-Kacheln,
    Diagramm, KI-Zustandsbericht, "Als nächstes fällig" und eine Baugruppen-Übersicht,
    ohne jede Aktion. Teile und Intervalle werden dort auf **dieselbe Kennzahl** gebracht
    (verbrauchter Anteil der Lebensdauer), damit "als nächstes fällig" wirklich eine
    Reihenfolge ist statt zweier Listen, die der Nutzer selbst gegeneinander abwägt;
    Posten ohne Datenbasis landen am Ende, nicht oben. `bike-service-page`
    (`bikes/:id/werkstatt`) enthält alles Verändernde: Baugruppen-Karten mit Aktionen,
    ungruppierte Slots, geparkte Sätze, alle Dialoge. Beide teilen sich
    `bike-header-component`, damit beim Tab-Wechsel nichts springt.
    `bike-service-page` lädt `GET bikes/<id>/assemblies/` und listet die Baugruppen als
    **kompakte Zeilen** (Punkt, Name, Teile/Pflege/km, Chevron), die ganze Zeile ist der
    Link. Jede Baugruppe hat eine **eigene Seite**: `assembly-detail-page` unter
    `bikes/:id/werkstatt/:assemblyId`. Vorher war das ein **Expansion Panel**
    (`assembly-card-component`, entfernt), das Kopfzeile, Statistik, Aktionsreihe,
    Umbenennen, Lösch-Bestätigung, alle Teile und alle Intervalle in eine aufklappbare
    Karte quetschte — bei sieben Baugruppen sieben davon untereinander. Die Route liegt
    bewusst **unter** `werkstatt/`, damit der Tab in der unteren Navigation aktiv bleibt
    (`routerLinkActive` ohne `exact`).
    **Einbaudatum für alle Teile** gibt es an zwei Stellen: auf der Werkstatt-Seite fürs
    ganze Rad, auf der Baugruppen-Detailseite für diese eine Baugruppe (beide über
    `setInstalledAtForAll()`). Gedacht für den häufigsten Fall — das Rad wird angelegt,
    nachdem die Fahrten schon in der App sind. Der Client schickt nur das Datum; den
    km-Stand leitet der Server aus der Fahrt-Historie ab, damit Teile und
    Nutzungszeitraum dieselbe Zahl sehen. **„+ Element hinzufügen"** auf der
    Detailseite trägt ein vergessenes Teil oder Verbrauchsmaterial nach
    (`addAssemblyItem()`); die Auswahl zeigt nur, was in dieser Instanz noch fehlt.
    Die Detailseite hält Umbenennen, die Aktionsreihe (**Wechseln** / **Teile erneuern** /
    **Auflösen**), die `slot-card-component`-Zeilen mit km-/Tage-Balken, die
    `interval-row-component`-Zeilen und die dazugehörigen Dialoge. Sie sucht ihre
    Baugruppe aus der `assemblies/`-Antwort statt sie einzeln zu laden — die liefert
    nebenbei die geparkten Alternativen, die der Wechsel-Dialog braucht. Nach
    **Wechseln** und **Teile erneuern** wird zur Werkstatt zurücknavigiert: in beiden
    Fällen ist die aufgerufene Instanz danach nicht mehr die aktive (geparkt bzw.
    ausgemustert). `notFound()` fängt den Fall ab, dass die Id nach so einer Aktion oder
    einem Auflösen nicht mehr in der Antwort steht.
    **Vorne/hinten kommt aus dem Feld, nicht aus dem Namen**: `bike-diagram-component`
    liest `template_detail.position` (`front`/`rear`/leer). Vorher wurde die Seite per
    `display_name.includes('vorne')` erraten — ein umbenannter Slot landete damit auf dem
    Vorderrad, weil das der Fallback war, und die Kassette trug „hinten" nie im Namen.
    **„Teile erneuern" erscheint nur bei `group_detail.kind === 'assembly'`**
    (`assembly-card-component::isSwappableAssembly`). In einem Bereich wie Bremse oder
    Cockpit verschleißen die Teile unabhängig und werden pro Zeile einzeln getauscht; das
    Backend lehnt `swap` dort mit 400 ab. **„Wechseln" bleibt überall**: zwischen zwei
    vorhandenen Sätzen zu wechseln ist nicht destruktiv und hat reale Fälle außerhalb der
    Laufräder (zwei Bremsbelag-Sätze, deren Mischung zum Laufradsatz passen muss).
    **Angelegt wird nur an einer Stelle**: `AssemblyWizardComponent` (Werkstatt →
    „+ Baugruppe anlegen"). Der Wechsel-Dialog hatte dafür früher eine zweite, eigene
    `AssemblyChecklistComponent` — zwei Stellen mit unterschiedlicher Bedienung, an denen
    dasselbe entsteht. Ein im Assistenten angelegter zweiter Satz entsteht geparkt und
    lässt sich im Wechsel-Dialog aufziehen. Das 🗑 heißt jetzt „Gruppierung
    auflösen" — die Teile bleiben am Rad.
    **KI-Texte** gibt es an drei Stellen, alle nach demselben Muster: erst auf Klick
    laden (die Generierung kostet einen AI-Call und ist Zugabe, nicht Voraussetzung
    fürs Rendern), Zustände `loading` / `error` / `text` als Signals, Fehlermeldung aus
    `err.error.error` mit Fallback-Satz. Zwei davon sitzen pro Komponente im
    `slot-card-component` ("Warum?" → `weather-explanation`, "Wie prüfen?" →
    `check-instructions`), der dritte pro Bike direkt in `bike-condition-page`:
    **"Zustandsbericht"** (`GET bikes/<id>/condition-report/`) fasst alle montierten
    Komponenten zusammen, zeigt `generated_at` und bietet "Neu generieren"
    (`?refresh=true`). Der Server cacht ihn und erkennt Staleness selbst; die
    Komponente verwirft den lokal gehaltenen Text zusätzlich bei jedem `reload()`
    und beim Bike-Wechsel, sonst bliebe der Bericht des vorigen Zustands stehen.
    **Löschen** (🗑 in der Aktionsreihe, ersetzt Wechseln/Teile-erneuern durch eine
    Zwei-Klick-Inline-Bestätigung statt eines eigenen Dialogs — kein Overhead für eine
    Aktion, die man selten braucht) ruft das harte `DELETE assemblies/<id>/`: cascadiert
    auf Slots/Components/Intervalle/Nutzungsperioden, anders als "Ausmustern" bleibt keine
    Historie übrig. Genauso für geparkte Sätze im Abschnitt **"Geparkte Baugruppen"**
    (`parked_assemblies`: Montieren / Ausmustern / 🗑, Bestätigung analog in
    `bike-service-page` selbst statt in einer Kind-Komponente, da dort keine
    Card-pro-Item-Komponente existiert).
    Anlegen: **`assembly-wizard-component`** — Vollbild-Assistent, **ein Teil pro Schritt**
    (Gruppe wählen → Grunddaten → je ein Schritt je Teil/Pflege → Zusammenfassung). Jeder
    Schritt stellt genau eine Frage („ist das dran?") mit zwei großen Flächen; Marke,
    Modell und Lebensdauer stehen optional darunter, wenn die Antwort ja lautet, und die
    Vorauswahl kommt aus `default_in_group` — Durchtippen ohne Nachdenken ergibt also ein
    brauchbares Ergebnis. Löst den früheren `add-assembly-dialog-component` ab, der alle
    Templates gleichzeitig als Zeile mit drei Eingabefeldern zeigte: bei „Laufrad hinten"
    acht Zeilen mit bis zu 40 Feldern auf einmal, am Handy unbenutzbar. Aus der
    Zusammenfassung springt man per Tipp zurück in jeden Schritt.
    **Bewusst nicht** im Setup-Stepper und im Swap-Dialog verwendet: der Stepper läuft
    bereits eine Baugruppe pro Schritt, ein Teil pro Schritt ergäbe dort bei acht Gruppen
    über achtzig Schritte für ein neues Rad. Beide nutzen weiter
    `assembly-checklist-component`.
    Neues Bike ohne Komponenten → `bike-setup-stepper-component` (ein Schritt je empfohlener
    Baugruppe). Davor liegt **Kudo** (`kudo-intro-component`, Schritt 0): Hersteller +
    Baujahr → Modellauswahl → Vorbelegung aller Schritte. Jeder Modellvorschlag zeigt
    seine `spec` (Serienausstattung in Stichworten) — daran erkennt der Nutzer, ob es
    wirklich sein Rad ist. Beim Klick geht diese `spec` an Schritt 2 mit
    (`chooseModel(model, spec)` → `fetchKudoSetup(..., spec)`), damit die
    Teilevorbelegung an genau dem angeklickten Rad ankert statt den Modellnamen erneut
    zu interpretieren; freies Eintippen schickt einen Leerstring. Der Stepper reicht sie per
    `prefill`-Input an die `assembly-checklist-component` durch, die daraus ihre Zeilen
    vorbelegt und mit einem Confidence-Badge als Vorschlag markiert. Ablauf und
    Korrigierbarkeit bleiben identisch — Kudo füllt nur Felder vor, überspringen und
    überschreiben geht wie vorher.
    **Zwei Dialoge, die man nicht verwechseln darf:**
    `switch-assembly-dialog-component` = "Wechseln" — listet die geparkten Sätze *derselben*
    Gruppe zum Direktwechsel (→ `assemblies/<id>/activate/`, der bisherige wird geparkt und
    behält seinen km-Stand) und bietet darunter "Neuen Satz anlegen" an, das dieselbe
    `assembly-checklist-component` mit `activate=true` wiederverwendet. Damit hat der Wechsel
    endlich etwas vorzuschlagen — genau das fehlte vorher. Jede Alternative in der Liste hat
    ebenfalls ein 🗑 mit derselben Zwei-Klick-Bestätigung wie die Baugruppen-Karten
    (`DELETE assemblies/<id>/`) — ersetzt bei Bestätigung nur "Montieren" für diese eine
    Zeile, nicht den ganzen Dialog.
    `quick-change-dialog-component` = "Teile erneuern" (→ `assemblies/<id>/swap/`): ersetzt
    die verschlissenen Teile *dieses* Satzes, der alte wird dabei ausgemustert.
    Einzelteil weiter über `add-component-dialog-component` / `component-swap-dialog-component`.
    **"Vorhandene Komponente übernehmen"**: `assembly-checklist-component` bekommt vom
    Aufrufer (`bike-service-page` über `switch-assembly-dialog-component`, analog im
    `assembly-wizard-component`) die ungruppierten Slots des Bikes als
    `ungroupedSlots`-Input. Findet sich pro Teile-Zeile ein exakt passendes Template darunter
    (mit montiertem Teil), wird automatisch ein Übernehmen-Vorschlag angeboten ("Vorhandene
    Komponente übernehmen: Marke Modell · X km") statt der Marke/Modell-Felder — abwählbar,
    falls doch ein zweites neues Teil gewünscht ist. Der Payload trägt dann
    `existing_slot_id` statt `brand`/`model_name`; das Backend hängt den Slot per Umhängen in
    die neue Baugruppe (Verlauf bleibt erhalten, keine neue Component).

shared/
  components/notification-component — Toast-UI (liest NotificationService-Signal)
  components/main-nav                — **zentrale Navigationsleiste**, fix am unteren
                                       Rand, ab 760px eine schwebende Pille. Fünf Ziele:
                                       Start · Fahrten · Bikes · Zustand · Werkstatt.
                                       Liegt in der App-Shell (`core/app.html`), nicht im
                                       Wartungsbereich — sobald sie auf Fahrten und Start
                                       verweist, muss sie auch dort stehen bleiben, sonst
                                       führt der Weg aus der Wartung heraus in eine Seite
                                       ohne Rückweg. **Sichtbarkeit hängt an der Route,
                                       nicht am angemeldeten Nutzer**: `StravaService.user`
                                       wird erst befüllt, wenn eine Seite es anstößt, und
                                       die Wartungsseiten tun das nicht — die Leiste war
                                       dort beim Direktaufruf verschwunden. Ausgeblendet
                                       auf `/login`, `/landingpage`, `/strava-callback`.
                                       „Zustand" und „Werkstatt" brauchen ein Bike und sind
                                       ohne eins deaktiviert statt versteckt (eine Leiste,
                                       die ihre Anzahl ändert, springt); die Id kommt aus
                                       `bikeService.selectedBike`. Den Abstand nach unten
                                       setzt `core/app.css` global über `--nav-height`.
  components/user-menu               — E-Mail ändern, Benachrichtigungen an/aus, Abmelden,
                                       **Konto löschen** (`deleteAccount()` → `DELETE
                                       strava/me/?confirm=true`). Zwei Schritte statt
                                       eines Dialogs: der erste Klick blendet die Warnung
                                       mit dem endgültigen Knopf ein, weil Fahrten, Bikes
                                       und die Verschleiß-Historie unwiderruflich
                                       verschwinden. Der Eintrag ist leiser gesetzt als
                                       „Abmelden" — selten gewollt, nie aus Versehen.
    Bewusst eine Shared-Komponente in den bestehenden Seiten-Headern (Dashboard,
    Wartung, Activity-Breadcrumb) statt einer globalen Topbar — so bleibt das Layout
    aller Seiten unangetastet.
  components/email-prompt-dialog     — fragt einmal pro Session nach der E-Mail, wenn
    `needs_email` gesetzt ist. Liegt in `core/app.html`, damit er unabhängig von der
    Landing-Route erscheint; „Später" merkt sich das in `sessionStorage` (nicht
    `localStorage` — sonst käme er nie wieder).
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
- `maintenance` → `loadChildren` → `MAINTENANCE_ROUTES`, flach: `''` = Bike-Liste,
  `bikes/:id` = **Zustand**, `bikes/:id/werkstatt` = **Werkstatt**,
  `bikes/:id/werkstatt/:assemblyId` = **Baugruppen-Detail**. Ein Bike hat also zwei
  Seiten statt einer — vorher lag beides in einer einzigen `detail-bike-component`. Die
  Baugruppen-Detailseite liegt bewusst unter `werkstatt/`, damit der Tab in der
  Navigation aktiv bleibt (`routerLinkActive` ohne `exact`). Ein Shell-Wrapper existiert
  hier **nicht** mehr: die Navigationsleiste liegt global in `core/app.html`.
  **Achtung:** Parent-Route selbst ist nicht mit `authGuard` versehen — vor Änderungen
  an Maintenance-Routing prüfen, ob das beabsichtigt ist.

## API-Kommunikation & Auth

- Base-URL aus `src/environments/environment.ts` (dev: `http://localhost:8000/api`) bzw.
  `environment.prod.ts` (`/api`, same-origin via Nginx-Reverse-Proxy). Kein zentraler
  `ApiService` — jeder Feature-Service (`StravaService`, `BikeService`, `ActivityService`)
  injiziert `HttpClient` direkt.
- **Session-Cookie-Auth, kein JWT.** `provideHttpClient` nutzt zusätzlich
  `withXsrfConfiguration({cookieName:'csrftoken', headerName:'X-CSRFToken'})` (Django-CSRF-
  Konvention). `authInterceptor` setzt nur `withCredentials: true` — keine Token-Logik.
  **Beim Debuggen von Auth-Problemen niemals einen `Authorization`-Header vorschlagen.**
  **Wichtig — `withXsrfConfiguration` allein reicht im lokalen Dev-Betrieb NICHT:**
  Angulars eingebauter `HttpXsrfInterceptor` haengt den Header laut eigener Quelle nur an,
  wenn Request- und Seiten-Origin identisch sind (`new URL(req.url).origin ===
  new URL(location.href).origin`) — bei Produktion stimmt das (`environment.prod.ts`:
  `apiUrl: '/api'`, relativ, selbe Origin via Reverse-Proxy), aber lokal ist `apiUrl`
  absolut (`http://localhost:8000/api`, andere Origin als der Angular-Dev-Server) und der
  Header blieb bislang komplett weg — jeder POST/PATCH/DELETE scheiterte lokal an Djangos
  CSRF-Pruefung ("CSRF token missing"), obwohl das (nicht-HttpOnly) `csrftoken`-Cookie im
  Browser lag. `csrf-interceptor` behebt das: liest das Cookie selbst und setzt den Header
  unabhängig von der Origin (das von Django empfohlene Muster für eine getrennt gehostete
  SPA). Gefunden erst beim Durchklicken der echten UI mit einem Browser (Playwright) — reine
  API-Testskripte gegen `django.test.Client`/`requests` hatten das nie bemerkt, weil sie
  Angulars HttpClient/Interceptor-Kette gar nicht durchlaufen. **Bei "funktioniert lokal
  nicht, in Produktion schon"-Berichten zu POST/PATCH/DELETE zuerst hier nachsehen.**
- Login: `Login`-Component baut Strava-Authorize-URL client-seitig und redirected per
  `window.location.href`. `StravaCallback` liest `code`/`scope`/`error` aus Query-Params,
  postet an `${apiUrl}/strava/auth/`, setzt `StravaService.user`-Signal, navigiert nach
  2s Delay zu `/dashboard`.
- `StravaService.user` traegt seit dem Usermenue auch `email`,
  `email_notifications_enabled` und `needs_email` (aus `GET /strava/me/`);
  `updateSettings()` schreibt sie per `PATCH /strava/me/` zurueck. `firstname` kommt
  weiterhin nicht vom Backend, sondern aus dem `localStorage`-Cache.
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

**Stand:** 13 der 28 Spec-Dateien schlagen fehl — allesamt generierte
"should be created"-Stubs, denen `provideHttpClient`/Router-Provider fehlen bzw. die
Komponenten mit `required`-Inputs oder WebGL-Abhaengigkeit instanziieren
(`map.spec.ts` scheitert an "Failed to initialize WebGL", weil jsdom kein WebGL hat).
Das sind Scaffold-Altlasten, keine echten Regressionen — aber sie machen `npm test` als
Signal wertlos. Bei neuen Features echte Assertions schreiben statt Scaffold uebernehmen;
die Stubs sollten mittelfristig entweder mit Providern versorgt oder geloescht werden.

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
