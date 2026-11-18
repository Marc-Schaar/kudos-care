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
  `src/styles.css`. Dark Theme ("Graphit") als Default, `prefers-color-scheme: light` wird
  zum "Zeichenpapier" der Landing-Page. **Die Tokens in `src/styles.css` sind die einzige
  Farbquelle**, jede Farbe hat genau eine Aufgabe: `--accent` (Lime) = Hauptaktion und "hier
  bist du", `--ok`/`--warn`/`--critical` = nur Status, `--rain` = nur Wetter. Der helle
  Modus hat eigene Ampel-Werte (die dunklen lagen auf Papier unter 2:1). Text auf
  Akzent/Status-Flächen nimmt `--accent-ink`, nie `#fff` (Weiß auf `--critical` = 3,7:1).
- **Schrift:** Barlow (Text), Barlow Condensed (Überschriften), DM Mono **nur für Zahlen
  und technische Beschriftung** (`.g-num`). Fließtext in Mono ließ alles gleich viel wiegen.
  Nichts unter 12 px.
- **Bausteine** in `features/app-maintenance/garage.css` (global, `g-*`), gelten für den
  ganzen Bereich nach dem Login, nicht nur die Wartung. Status ist immer **Form + Farbe**
  (`.g-dot`/`.g-pill`: Kreis ok, Dreieck warn, Raute critical, Ring unbekannt).
  `.g-rows > * + *` muss **hinter** `.g-row` stehen, sonst setzt dessen `border: 0` die
  Trennlinien zurück.
- **Icons:** `shared/components/icon` mit Pfaddaten aus Lucide (ISC) in `icons.ts`, kein
  Laufzeit-Paket, keine Emoji/Glyphen als Icons. Neue Icons aus Lucide übernehmen.
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
  `anyComponentStyle` 10kB warn / 16kB error, gilt je Stylesheet. Die Landing-Page verteilt
  ihre Styles deshalb auf drei Dateien in `styleUrls`, die Reihenfolge zählt)
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
    error-interceptor/         — globaler HTTP-Error-Handler → NotificationService-Toast;
                                  `SKIP_ERROR_TOAST` (HttpContext) schaltet ihn je Request ab

features/
  app-landing/                  — Öffentliche Marketing-Landing-Page (`/`, die Startseite,
    lazy, kein authGuard). **Eine gepinnte Bühne, zwei Gründe, eine Trennlinie** (Grammatik
    "Split Stage", Begründung in `scrollcraft/builds/kudos-care/BRIEF.md`): links die Kette,
    rechts der Tacho, weil das Rad nach rechts fährt und die Kette damit hinten liegt, der
    Tacho vorn. Dasselbe Rad wird in `landing-scene` zweimal gestempelt (`dark`/`paper`),
    die obere Kopie per `clip-path` an der Linie abgeschnitten; darum endet auch der Regen
    (`rain-layer.ts`, Canvas) von selbst hart an der Linie. Alles hängt an einer Zahl, der
    Bühnenzeit `t`, und läuft über direkte DOM-Zugriffe in einem rAF-Loop, der nur läuft,
    solange sich etwas bewegt. Signals nur für die Regler.
    **`models/wear-formula.ts` ist eine Kopie** von `WeatherWearCalculator` plus den
    Koeffizienten aus Migration `0006` im Backend, weil die Seite ohne Anmeldung rechnet
    und es keinen öffentlichen Endpoint gibt: ändert sich die Formel dort, hier nachziehen.
    Die Fahrten in `models/sample-season.ts` sind erfunden und auf der Seite so
    gekennzeichnet; die Zahlen in den Sätzen ("Noch 460 km") werden daraus berechnet, nicht
    getippt. Die Seite behauptet nur, was das Produkt tut: keine Betriebsstunden und kein
    Höhenprofil (die Formel nutzt beides nicht), kein Motorrad (`BikeType` kennt keins).
    **Bewusst ohne die Scrollcraft-Engine**: sie hat kein Teardown, ihre Listener und ihr
    rAF-Loop liefen nach dem Routenwechsel weiter, und ihr CSS setzt `html`/`body` global
    zurück. Die `data-sc-*`-Attribute bleiben als Marker für den Prüf-Harness.
    **Drei Stolperfallen, alle schon passiert:** (1) Cue-Blöcke liegen unsichtbar
    übereinander. Alles Flächige braucht `pointer-events: none`, sonst fängt eine
    unsichtbare Liste die Klicks auf den CTA ab; Screenshots zeigen das nicht. (2) Cues
    arbeiten nur mit Deckkraft: `visibility: hidden` nähme Regler und CTA aus der
    Tab-Reihenfolge. Fokus auf einem verdeckten Element fährt die Bühne per `data-focus-at`
    an die Stelle, an der es sichtbar ist. (3) Ein Cue je Grund: ein Element, das beide
    Hälften überspannt, misst der Harness gegen den falschen Hintergrund.
    Bei `prefers-reduced-motion` löst sich die Bühne in normalen Seitenfluss auf
    (`landingpage.reduced.css`), dann läuft kein Loop.
  app-legal/                    — Impressum (`/impressum`) und Datenschutz (`/datenschutz`),
    öffentlich. `legal-contact.ts` hält die Betreiberangaben; eckige Klammern dort heißen: noch
    nicht launch-fertig. Die Datenschutzerklärung beschreibt den Code: neuer externer Dienst,
    Cookie oder Datenfeld, dann dort nachtragen (`legal-pages.spec.ts` prüft die Dienste).
    Erreichbar über `shared/components/legal-links`: in der App-Shell mit dem offiziellen
    "Powered by Strava"-Logo, auf der Landing-Page ohne. Die Strava-Grafiken in
    `public/strava/` kommen unverändert aus den Brand Guidelines, also nicht nachbauen.
    **Einwilligungen:** Wetter und KI geben Daten an Dritte, das braucht laut Stravas API
    Agreement eine ausdrückliche Zustimmung. Wetter: unvorausgewähltes Kästchen im Login, reist
    über den OAuth-`state` durch den Strava-Roundtrip. KI: das Backend antwortet mit 403
    `ai_consent_required`, `aiConsentInterceptor` zeigt `ai-consent-dialog` und wiederholt die
    Anfrage; KI-Aufrufstellen wissen davon nichts. Beides im Benutzermenü widerrufbar.
    **Schriften** sind selbst gehostet (`@fontsource`), nicht zurück zu Google Fonts wechseln.
  app-login/                   — Login (`/app/login`), Strava-OAuth-Callback
    (`/app/strava-callback`), authGuard. login.html verlinkt auf `/` (Landing-Page).
  app-dashboard/                — Startseite nach Login. Oben **ein Befund-Satz**
    (`verdict.ts::buildVerdict`, getestet): zählt überfällige *Dinge*, nicht Räder (vorher
    "1 überfällig" neben "6 überfällig" auf der Rad-Seite). Darunter die Werkstattzeichnung
    des dringendsten Rads (Umschalter bei mehreren), "Als Nächstes dran" mit `Erledigt`,
    Strichliste und letzte Fahrten. Lädt dafür `assemblies/` je aktivem Rad; ein Rad, das
    nicht lädt, blendet die übrigen nicht aus.
    **Nächste Fahrt** (`components/next-ride`, Logik in `forecast.ts`, getestet) unter der
    Zeichnung: "In 3 Tagen fährst du wahrscheinlich wieder, rund 46 km" plus "Vor der
    nächsten Fahrt prüfen". Daten aus `GET bikes/<id>/next-ride/`, getrennt von
    `assemblies/` geladen (Zugabe, darf die Zeichnung nicht aufhalten). Der Server liefert
    nur Schlüssel + `status_today`/`status_then`; Titel, Baugruppe und Restwert kommen aus
    den vorhandenen `DueItem`s (`part-<id>`/`interval-<id>`), damit ein Teil nicht an zwei
    Stellen verschieden heißt. Gelistet wird nur, was die Fahrt **neu** über eine Grenze
    schiebt — schon heute Fälliges steht in "Als Nächstes dran". Unter der Maßlinie
    steht der **Wetterbericht für den Fahrtag** (`weather.ts`, getestet) als Randnotiz im
    Wetter-Blau `--rain`: Wetter im Fahrfenster plus ein Satz, was es fürs Rad heißt
    (serverseitig formuliert, `forecast.weather.report.wear.text`). Gleiche Wortwahl wie
    die Vorhersage-Mail (`presentation.py::weather_note` im Backend) — beide nachziehen.
    Nur `consent_required` bekommt einen Hinweis, andere Gründe ohne Bericht bleiben still. Die **Maßlinie ist
    zeitmaßstäblich** bis `RULER_DAYS` (14), darüber Bruchkante wie beim Verschleiß-Lineal;
    links Lime = heute, rechts die Ampel-Form des Rads am Fahrtag. Bei `is_overdue`
    (Pause) keine Linie und kein "heute", sondern "Nach deinem Rhythmus wärst du schon
    wieder dran". Ohne genug Fahrten ein leiser Hinweis, wie viele noch fehlen.
  app-activity/                 — Strava Activity List/Detail, Map, Wetter-Overlay
    pipes/headwind-label, services/activity-service
    `models/ride-insights.ts` liest aus `GET /activities/` (liefert `track` als WKT und
    `weather_data`): Routenform (`route-glyph`), nass ab 0,5 mm/h im Stundenmittel,
    Monatsgruppen, Strichliste (`ride-tally`). `ride-row` ist die gemeinsame Zeile für Start
    und Fahrtenliste. **Achtung:** der Endpoint liefert alle Fahrten samt Track ohne
    Pagination (~5 kB je Fahrt) — bei großen Konten im Backend kürzen, dann hier anpassen.
    Die Karte nutzt OpenFreeMap `dark`/`positron` passend zum Farbmodus (die bunte
    `liberty` erschlug die Einfärbung). Wind in **km/h** (Open-Meteo-Default).
    Die Karte (`components/map`) rendert die **fertigen `wind_segments` vom Backend**
    und interpoliert selbst nichts mehr. Früher schnitt sie den vereinfachten Track in
    Segmente und verteilte die Stundenwerte über den Segment-Index — das war falsch,
    weil RDP in Kurven viele und auf Geraden wenige Punkte behält.
    **Windprofil** (`components/wind-profile`, Logik in `models/wind-profile.ts`, getestet):
    die Fahrt über die Distanz abgerollt wie ein Höhenprofil, Gegenwind über, Rückenwind
    unter der Nulllinie, im Regen-Modus Niederschlag. Ersetzt die früheren Stunden-Charts für
    Wind und Regen (gleiche Aussage, andere Achse, liefen optisch auseinander); rechts bleibt
    nur Temperatur. Profil und Karte teilen sich `activeSegment` (`properties.index`, beidseitig
    gebunden): Zeigen/Tippen auf Balken oder Strecke hebt die Stelle auf der Karte mit Ring
    hervor, die Zahlen stehen **im Satz über dem Profil**, das Karten-Popup ist entfallen. Die
    km-Achse wird auf Stravas `distance_km` gestreckt, sonst nennt die Seite zwei Längen
    (GPS-Abschnitte summieren sich anders). Wind ist relativ zur Fahrt skaliert, Regen mit
    Untergrenze `RAIN_SCALE_FLOOR_MM` (sonst sieht Niesel wie Wolkenbruch aus) — Karte und
    Profil müssen dieselbe Skala benutzen. Der Befund-Satz im Kopf ("18 von 42 km gegen den
    Wind") erscheint nur bei `wind_source = stream`.
    `wind_source` steuert den Hinweis darunter: `coarse` = grobe Start-Ziel-Schätzung,
    `none` = keine Winddaten, Route neutral (Normalfall vor dem `recompute_wind`-Backfill).
    Karte „Was diese Fahrt gekostet hat" = `GET activities/<id>/wear-impact/`, volle Breite.
    Darin **Verschleiß-Verlauf** (`components/wear-trace`, Logik in `models/wear-trace.ts`,
    getestet): gefahrene km gegen Verschleiß über die Distanz, schraffiert der Aufschlag
    (blau nur bei Regen, wie `wear-impact`). Liest `segment_extra_km` aus dem Backend und
    rechnet selbst nichts; endet auf gefahren + `extra_km`, also derselben Zahl wie der
    Satz der Aufschlüsselung. Teilt `activeSegment` mit Karte und Windprofil, und hat
    dieselben Spaltenbreiten wie das Windprofil, damit beide Zeichenflächen bündig stehen.
  app-maintenance/               — Kern-Domäne: Bikes → Baugruppen → Elemente, Verschleiß
    services/bike-service, pipes/(km, warn-class, warn-label)
    models/maintenance.models.ts — BikeList/BikeDetail, BikeAssembly, ComponentGroupCatalog,
                                   MaintenanceInterval, ComponentSlot, BikeComponent, ...
    **Der Wartungsbereich ist mobile first gebaut**: Basis-CSS gilt für schmale Screens,
    breitere bekommen Ausnahmen per `min-width` (nicht umgekehrt). Trefferflächen ≥ 44 px,
    Eingabefelder mit `font-size: 16px`, damit iOS beim Fokus nicht hineinzoomt.
    Die Navigationsleiste liegt **nicht** hier, sondern global in der App-Shell (siehe
    `shared/components/main-nav`).
    **Werkstattzeichnung** (`components/bike-blueprint`, Rechnung in
    `shared/utils/blueprint.ts`, getestet): das Rad als Illustration mit Hinweislinien zu
    jeder aktiven Baugruppe, darunter Tacho und Wetter als zwei Maßlinien desselben Teils
    (`largestWeatherGap`, bewusst nicht Bike-Gesamt-km gegen Teil-km). Der Punkt am Rad kommt
    aus `group_detail.category`/`.position`, **nie aus dem Namen**; Gruppen ohne festen Ort
    (`accessories`) bekommen keine Linie. Unter 860px Containerbreite (Container-Query)
    Nummern am Rad plus Liste, die zuerst nur Auffälliges zeigt. Landmarken müssen zu den
    SVGs in `public/bike-illustrations/` passen. Keine `vector-effect: non-scaling-stroke`
    auf den Linien: Chrome ignoriert damit `pathLength` und die Einzeichen-Animation zerfällt.
    Die Illustration wird in der Zeichnung per `filter: grayscale(1)` zu Tusche: in den SVGs
    steckt Lime (Felgen, Tretlager), in der Zeichnung ist Farbe aber Befund. Radliste und
    Dashboard zeigen dieselben Dateien farbig, deshalb nicht in den SVGs ändern. Die
    Maßlinien heißen nach dem Teil („Kette laut Tacho …", „mit Wetter … (+21 %)"); schmal nur
    die Kurzform, sonst schneidet die Linie sie ab. Auf der Rad-Seite liegt der Inhalt in
    einem eigenen Container (`.body`), damit die Baugruppen-Liste genau dann verschwindet,
    wenn die Zeichnung auf Beschriftung neben dem Rad umschaltet (862px = 860 + Rahmen) —
    dort stünde sonst jede Baugruppe samt Ampel zweimal.
    **Rad | Keller** ist die eine Linie, an der sich Wechseln und Anlegen abspielen
    (Bausteine `.g-axis`/`.g-tag`/`.g-cross-in-*` in `garage.css`): links am Rad (Fläche,
    Lime-Kante), rechts im Keller (nur gestrichelte Kontur), dazwischen eine
    Strich-Punkt-Achse. `components/rad-keller` steht auf der Rad-Seite in voller Breite
    unter der Zeichnung; `buildBoard()` (`utils.ts`, getestet) nimmt alle Laufradsätze und
    **nur die Bereiche, von denen es eine zweite Instanz gibt** (z.B. zwei „Bremse hinten") —
    geparkte Bereiche waren vorher auf der Rad-Seite unsichtbar. Dieselbe Linie wiederholt
    sich als Lage-Leiste auf der Baugruppen-Seite (diese Instanz + ihre Geschwister), als
    Live-Vorschau im `wheelset-sheet` (der neue Satz steht auf der Seite, wo er landet) und in
    der Checkliste (angehakt = Rad-Optik, nicht angehakt = Keller-Optik).
    **Laufrad wechseln** (`components/switch-sheet`): die Server-Vorschau als Tauschliste,
    eine echte `<table>` mit den Spalten „Am Rad" | „Im Keller", die den **aktuellen** Stand
    zeigt; nach dem Wechsel ziehen die Einträge über die Achse (die einzige Animation des
    Bereichs, `CROSS_HOLD_MS`), erst dann schließt das Blatt. Schließen während des Haltens
    gilt als fertig gewechselt (`close()` → `switched`), sonst bliebe die Seite ungeladen.
    `buildSwapRows()` paart Laufräder über `group_name`, mitwechselnde Teile über den Platz;
    einseitige Wechsel bleiben als Zeile mit „nichts" stehen.
    **Verschleiß-Lineal** (`components/wear-meter`): Marken bei 80/100 %, Skala bis 125 %,
    darüber eine **Bruchkante** (unterbrochene Achse) mit dem Vielfachen der Lebensdauer
    (`formatTimes()`: „3,5×“, ab 10 ganzzahlig) — vorher endete alles Überfällige in derselben
    Spitze, 3,5× und 7× sahen gleich aus; mit `[part]` schraffiert der Wetter-Aufschlag hinter dem Tacho-Stand
    (nur wenn die km-Achse die Ampel treibt). `DueItem.remaining` ("noch 709 km",
    "863 km drüber") ist die Zahl, nach der gehandelt wird. `due-row` ist die gemeinsame
    Zeile für Start und Rad-Seite.
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
  services/navigation-service        — **alle Wege durch die App an einem Ort**.
                                       `nav.to.*()` liefert die Segmente für
                                       `[routerLink]`, `nav.goTo(...)` navigiert im Code;
                                       beide teilen dieselbe Definition. Vorher standen
                                       die Pfade als Literale verstreut und waren bereits
                                       auseinandergelaufen — dieselbe Bike-Seite hieß an
                                       einer Stelle `['/maintenance/bikes', id]`, an
                                       anderer `['/maintenance', 'bikes', id]`. Es gibt
                                       **keine** hartkodierten Routen mehr in Templates
                                       oder Komponenten; einzige Ausnahme ist
                                       `auth-guard`, der `createUrlTree` braucht (ein
                                       Guard gibt ein Ziel zurück, er springt nicht) —
                                       den Pfad holt auch er aus dem Service.
  components/main-nav                — **App-Chrome**: am Handy Kopfzeile (Wortmarke +
                                       Benutzermenü) und Leiste unten, ab 960px eine
                                       Seitenleiste (`--rail`). Vier Ziele: Start ·
                                       Fahrten · Räder · Mein Rad. `isAppRoute()` entscheidet
                                       auch das Layout in `core/app.html` (`.in-app`).
                                       Stößt `fetchUser()`/`fetchBikes()` selbst an.
                                       Liegt in der App-Shell (`core/app.html`), nicht im
                                       Wartungsbereich — sobald sie auf Fahrten und Start
                                       verweist, muss sie auch dort stehen bleiben, sonst
                                       führt der Weg aus der Wartung heraus in eine Seite
                                       ohne Rückweg. **Sichtbarkeit hängt an der Route,
                                       nicht am angemeldeten Nutzer**: `StravaService.user`
                                       wird erst befüllt, wenn eine Seite es anstößt, und
                                       die Wartungsseiten tun das nicht — die Leiste war
                                       dort beim Direktaufruf verschwunden. Ausgeblendet
                                       auf `/` (Landing-Page, per Sonderfall
                                       `url === '/'`), `/app/login`,
                                       `/app/strava-callback`.
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
    Liegt einmal im App-Chrome (`main-nav`), nicht mehr in Seiten-Headern: dort fehlte
    es auf den Fahrten und jeder Rad-Seite. Öffnet am Desktop nach oben.
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

## Radcomputer (`features/app-radcomputer/`)

Radcomputer für den Lenker (iPhone X mit iOS 16 in Bluefy, wegen Web Bluetooth):
Datenseiten, Powermeter/Pulsgurt per BLE, Navigation mit Abbiegehinweisen, Trainingsmodus
(ZWO/ERG/MRC), Aufzeichnung als TCX und Upload zu Strava. Kam aus einem eigenen Projekt
dazu und ist bewusst ein abgeschlossener Bereich mit eigener Bedienung:

- **Vollbild über Kudos Care.** `isFullscreenRoute()` (main-nav.ts) blendet Leiste und
  Fußzeile auf `/app/radcomputer` aus; `rc-shell` legt sich `position: fixed` darüber und
  bringt eigene Bedienung mit (☰ Menü · Runde · Start), Rückweg im Menü „Zu Kudos Care“.
- **Eigene Farben und Grundstile, nur unter `.rc`** (`radcomputer.css`, per `@import` in
  `styles.css`). Kudos und Radcomputer nutzen dieselben Variablennamen (`--bg`, `--muted`,
  `--ok` …) mit anderen Werten — Radcomputer-Regeln deshalb nie ohne `.rc`-Präfix global
  machen. Tag/Nacht setzt die Shell als `data-theme` auf sich, nicht aufs Dokument.
- **Gestaltung: Straßenschild.** Schrift DIN (`--digits`, auf dem iPhone „DIN Alternate“,
  offline vorhanden, bewusst keine Webfonts) für Zahlen, Titel, Beschriftungen und Tasten;
  Systemschrift nur für Fließtext. Farben je eine Aufgabe: `--go` (Lime, die Kudos-Marke) =
  Aufnahme läuft und Hauptaktion, `--hold` = Auto-Pause/Abweichung vom Trainingsziel,
  `--warn` = Route verlassen/Fehler. Am Tag ist `--go` Oliv mit `--go-ink` Weiß, Lime trägt
  auf Weiß keinen Text. Sensorzustand als Form (`.sense`: Ring aus, gestrichelt sucht, Punkt
  verbunden, Raute Fehler). Der Abbiegehinweis ist **ein** Bauteil, `nav/cue-sign.ts`: ein
  Wegweiser-Schild, dessen Spitze in die Abbiegerichtung zeigt (Shell-Streifen und Karte),
  bei verlassener Route rot. Neue Hinweis-Anzeigen nehmen dieses Schild, keine eigene Kopie.
  Leistungsfelder (Momentan, 3/10/30 s, Runde Ø) tragen die **Zonen-Leitlinie**: sieben
  Striche Z1–Z7 unter der Zahl, die aktuelle Zone als Block (`FieldReading.zone` aus
  `powerReading()`, gezeichnet in `ride/data-field.ts`) — dieselbe Sprache wie die
  Seitenanzeige. **Bewusst ohne Zonenfarben**: Die Linie folgt dem Aufnahmezustand wie die
  Ziffern (voll, Umriss, Gelb), sonst bräche die Regel „Farbe = Zustand“.
- **Ein Paket, kein Lazy Loading innerhalb.** `radcomputer.routes.ts` importiert alle Seiten
  statisch: unterwegs ohne Netz darf kein Seitenwechsel an einem fehlenden Chunk scheitern.
- **Pfade** in `core/paths.ts` (`RC`), analog zum NavigationService.
- **Strava** über die Kudos-Session (`core/strava.ts` → `/api/radcomputer/*`). Der Login
  fragt `activity:write` und `read_all` direkt mit an (`STRAVA_SCOPE` in
  `strava-service.ts`, von Login und Radcomputer geteilt) — Strava ersetzt die Rechte bei
  jeder Anmeldung, ein Login mit kleinerem Scope nähme die Upload-Freigabe wieder weg.
  Strava lässt einzelne Rechte aber abwählen; nur dann erscheint „Upload bei Strava
  freischalten“ (gleicher Scope, `state=radcomputer`, der `StravaCallback` führt zurück in
  den Radcomputer). `GET /api/strava/me/` liefert `can_upload`/`private_routes`.
- **Angular 21 bleibt Pflicht**, solange der Radcomputer aufs iPhone X (Safari 16.6) muss:
  Angular 22 setzt Safari ≥ 17.2 voraus.
- **Pause → Stop.** Pausiert wird aus „Runde“ die Taste „Weiter“ und aus der Hauptaste
  „Stop“. Stop beendet nicht sofort, sondern öffnet „Fahrt abschließen“ (`menu/save-page.ts`).
  Dort: Titel, Rad (aus `maintenance/bikes/`, nur aktive mit `strava_bike_id`, das zuletzt
  gewählte wird vorgeschlagen), Art (`sport_type`, folgt dem Radtyp, bis man sie selbst
  wählt), Tags (Pendelfahrt, Rolle, Nicht im Feed) und Beschreibung. Der Entwurf liegt in
  `RideSync.draft`, damit er Seitenwechsel übersteht. Upload: `commute`/`trainer`/
  `description` gehen mit `/uploads`, der Rest nimmt Stravas Upload nicht an und geht danach
  über `POST /api/radcomputer/activities/<id>/complete/` — derselbe Aufruf importiert die
  Fahrt sofort nach Kudos Care (der Webhook läuft nicht zuverlässig). Danach bleibt die
  Seite stehen und zeigt das Ergebnis (Strecke, Zahlen, gesetzte Tags, Links zu Strava und
  Kudos Care), statt mit einem Toast auf die leere Fahrtseite zu springen. Bis dahin bleibt
  die Fahrt pausiert und lässt sich mit „Weiter“ fortsetzen. „Rennen“/„Training“ fehlen
  bewusst: `workout_type` ist in Stravas `UpdatableActivity` nicht dokumentiert.
- **Einstellungen** liegen im Konto (`GET|PUT /api/radcomputer/settings/`, snake_case,
  Mapping in `settings-store.ts::API_FIELDS`), `localStorage` hält nur die Offline-Kopie
  für den Start ohne Netz. Gespeichert wird erst nach dem ersten Abgleich (sonst
  überschreibt ein altes Gerät die Kontowerte) und entprellt; `stored: false` vom Server
  lädt die lokalen Werte einmalig hoch.
- **Feste Ziele** liegen nur noch im Konto, serverseitig verschlüsselt
  (`/api/radcomputer/places/`), **nicht** mehr im Browser — „Zuhause“ ist die
  Wohnadresse. Der alte Schlüssel `radcomputer.places.v1` wird beim ersten erfolgreichen
  Laden hochgeladen und gelöscht. Ohne Netz ist die Liste leer (`unavailable`); das Routen
  braucht ohnehin Internet.
- **Die laufende Fahrt liegt in `localStorage`, in Stücken** (`core/ride-recorder.ts`):
  Kopf `radcomputer.ride.v3` (Zustand, Zahlen, Runden) plus Track-Stücke
  `radcomputer.ride.v3.<n>` zu je 300 Punkten. Gesichert wird alle 5 s, dabei nur das
  wachsende Stück — vorher alle 20 s die komplette Fahrt (nach 3 h fast 1 MB je Sicherung).
  Erst die Stücke, dann der Kopf: scheitert ein Stück am vollen Speicher, verweist der alte
  Kopf nur auf vollständige. Ein hart beendeter Tab verliert höchstens die letzten Sekunden;
  das alte Format `v2` wird beim Start übernommen.
- **Datenseiten frei belegbar** (`ride/fields.ts`, Editor `menu/data-pages-page.ts`,
  `menue/einstellungen/datenseiten`): `FIELDS` ist das Register (Schlüssel, Gruppe, Einheit,
  `kind` für die Kacheln Wind und Klingel), `RideFields.readings` rechnet alle Werte einmal
  je Sekunde, `core/ride-metrics.ts` führt, was der Recorder nicht kennt (NP, kJ, Ø/Max-Puls,
  Ø-Kadenz ohne Rollphasen, Max-Tempo, Abstieg, Steigung, Steigrate) — aus dem Track, damit
  es nach dem Wiederherstellen stimmt. Gespeichert in `Settings.dataPages`, leer =
  `DEFAULT_PAGES` (die drei früheren festen Seiten). Unbekannte Schlüssel fallen still weg
  (`effectivePages`), das Backend prüft nur die Form. Raster: erstes Feld groß, Rest
  paarweise, ein übriges über die volle Breite (`pageLayout`). Die Ziffern skalieren über
  Container-Einheiten mit dem Feld, nicht mit dem Bildschirm. Musik und Benachrichtigungen
  anderer Apps gibt es als Feld nicht: dafür hat eine Webseite unter iOS keine Schnittstelle.
- **Fahrtrichtung** (`core/heading.ts`): in Fahrt GPS-Kurs, unter ~7 km/h der Kompass des
  Telefons (`webkitCompassHeading`, sonst `deviceorientationabsolute`). Karte, Kompassnadel
  und Wind lesen `Heading.value`, nicht mehr `Gps.heading`. iOS gibt den Kompass erst nach
  `DeviceOrientationEvent.requestPermission()` aus einem Tipp frei — `enable()` hängt an
  Start/Weiter, am Kompassknopf und an den Einstellungen.
- **Regen** (`core/touch-lock.ts`, `ride/lock-overlay.ts`): Sperre über allem, entsperrt
  wird nur durch 1,2 s Halten auf dem Schloss. Die Shell blockt zusätzlich Pinch-Zoom
  (`gesturestart`), Doppeltipp und Kontextmenü, die Fahrtseite hat `touch-action: none`.
  Vollbild nur per Feature-Erkennung: iPhone-Browser erlauben es für Seiten nicht.
- **Klingel**: `AudioFeedback.bell()` (Web Audio, synthetisch; mischt sich mit Musik, bleibt
  im iOS-Stummmodus aber still), als Taste in der Bedienleiste (`bellButton`), auf der Karte
  und als Datenfeld.
- **Kartenbild** (`nav/map-canvas.ts::TILE_SOURCES`): CyclOSM (Standard), OpenTopoMap, OSM.
  Über der höchsten Stufe eines Dienstes werden dessen Kacheln vergrößert, bei Zoom mit
  Nachkommastellen (Pinch) wird die Kachelstufe gerundet.
- **Karte = Kamera** (`nav/map-camera.ts`, getestet): `rc-map` zeichnet, was `camera`
  (Mitte in Web-Mercator, Zoom, `bearing` = Kurs oben, `anchorY`) vorgibt; ohne Kamera die
  ganze Route (`fitCamera`). Gesten sitzen in `rc-map` selbst: ein Finger verschiebt, zwei
  zoomen und drehen (Drehen erst ab 12° Verdrehung), Mausrad zoomt; jede Geste setzt
  `camera` per `model()`. Ein Verschieben schluckt den folgenden `click`, sonst blendete die
  Fahrtseite die Leiste ein. Auf der Karte blättert Wischen **nicht** mehr (`ride-page`
  ignoriert Berührungen in `rc-map`), geblättert wird über Hinweis-Schild, Werteleiste und
  Seitenstriche. Kompassnadel und Windpfeil lesen die Drehung der Karte (`bearing`), nicht
  den Kurs.
- **Kartenseite** (`nav/map-view.ts`): folgt dem Standort und zoomt nach Tempo
  (`zoomForSpeed`: bis 12 km/h Stufe 17, bei 45 km/h 15, rund eine Minute Sicht nach vorn;
  `SpeedZoom` glättet das Tempo über ~8 s und rastet in Viertelstufen). Zustand in
  `RideView`, damit er das Blättern übersteht: `mapZoom` = Zoom von Hand per Taste, Karte
  fährt weiter mit; `mapFree` = verschoben/gedreht, Karte steht. Beides blendet
  „Zentrieren“ ein (`recenterMap()`: zurück zum Standort, Zoom wieder nach Tempo). Eine
  verschobene Karte kehrt nach 20 s ohne Eingriff von selbst zurück, aber nur in Fahrt.
  Die noch zu fahrende Strecke ist nach Wind gefärbt (`nav/route-wind.ts`, getestet): rot
  Gegenwind, grün Rückenwind, Seitenwind in der Grundfarbe, Einteilung aus `relativeWind`
  wie bei Windpfeil und -balken. Es gibt nur den aktuellen Wind am Standort, er gilt für die
  ganze Strecke. Ohne Windwert (keine Einwilligung, älter als 30 min) bleibt die Linie einfarbig.
- **Routenvorschau** (`nav/route-plan-page`): jede neue Route (GPX, Strava, Ziel, Demo)
  erscheint erst als Ebene über der Liste mit der ganzen Strecke, Länge, Hinweisen und dem
  Abstand zum Start; geführt wird erst nach „Route starten“. Dafür sind Laden und Starten
  in `RouteGuide` getrennt (`routeFromGpx`/`routeFromFile`/`plan` liefern nur die Route,
  `start()` übernimmt und sagt an); die laufende Route bleibt bis dahin unberührt. Die
  Neuberechnung unterwegs geht ohne Vorschau.
- `?demo` an der Adresse simuliert GPS und Sensoren (Beispielroute/-training im Menü).

## Routing (`core/app.routes.ts`, `maintenances.routes.ts`)

- `''` → die öffentliche Landing-Page (lazy, `loadComponent`, ungeschützt) — das ist die
  Startseite von `kudoscare.marc-schaar.com`. `landingpage` bleibt als reiner
  Redirect auf `''` bestehen (alte Url).
- Die eigentliche App liegt komplett unter **`app/`** (eigene Zeile in
  `app.routes.ts`, `children:`): `''` → redirect `login`, `login`/`strava-callback` →
  eager, ungeschützt, `dashboard` → eager, `authGuard`, `activities`/`activity/:id` →
  lazy (`loadComponent`), `authGuard`, `maintenance` → `loadChildren` →
  `MAINTENANCE_ROUTES`, `radcomputer` → `loadChildren` → `RADCOMPUTER_ROUTES`, `authGuard`
  (Unterseiten `fahrt`, `menue`, `menue/route|training|speichern|einstellungen`). Kein Template/keine Komponente baut diese Pfade selbst
  zusammen — `shared/services/navigation-service` liefert sie bereits mit dem
  `app/`-Präfix, das ist die einzige Stelle, die eine Änderung hier kennen muss
  (Ausnahme: `login.ts` baut die Strava-`redirect_uri` clientseitig aus
  `environment.redirectUrl + '/app/strava-callback'`, weil das kein Router-Pfad ist).
- `maintenance` → `loadChildren` → `MAINTENANCE_ROUTES`, flach (Pfade relativ zu
  `app/maintenance/`): `''` = Bike-Liste,
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
  Konvention). `authInterceptor` setzt nur `withCredentials: true` — keine Token-Logik —,
  und wie `csrfInterceptor` **nur für die eigene API** (`core/interceptors/api-request.ts`).
  Vorher gingen Cookies und CSRF-Token an jede Anfrage, auch an BRouter/OSRM/Photon im
  Radcomputer; deren `Access-Control-Allow-Origin: *` lehnt der Browser mit Cookies ab, und
  keine Route kam zustande. Fremde Dienste brauchen keine Ausnahme mehr, nur neue eigene
  APIs unter einer anderen Basis-URL müssten in `isApiRequest` auftauchen.
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
- Login: `Login`-Component (`/app/login`) baut Strava-Authorize-URL client-seitig
  (`redirect_uri` = `environment.redirectUrl + '/app/strava-callback'`) und redirected
  per `window.location.href`. `StravaCallback` (`/app/strava-callback`) liest
  `code`/`scope`/`error` aus Query-Params, postet an `${apiUrl}/strava/auth/`, setzt
  `StravaService.user`-Signal, navigiert nach 2s Delay zu `/app/dashboard`.
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
Einzelnes Feature: `npx ng test --watch=false --include="src/app/features/app-landing/**/*.spec.ts"`.

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
