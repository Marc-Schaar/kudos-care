# 🚴 Kudos Care

**Wartungs-Tracking-App für Fahrräder/Motorräder mit Strava-Integration**, gebaut mit Angular 21 (Standalone Components, Signals) und Tailwind CSS.

![Angular](https://img.shields.io/badge/Angular-21-DD0031?logo=angular&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-testing-6E9F18?logo=vitest&logoColor=white)
![Strava](https://img.shields.io/badge/Strava-OAuth-FC4C02?logo=strava&logoColor=white)

📁 **Repository:** [github.com/Marc-Schaar/kudos-care](https://github.com/Marc-Schaar/kudos-care) · 🖥️ **Backend:** [kudos_care_backend](https://github.com/Marc-Schaar/kudos_care_backend) · 🌐 **Portfolio:** [marc-schaar.com](https://marc-schaar.com)

> Persönliches Projekt mit echten Strava-Trainingsdaten – kein öffentlicher Live-Demo-Link, aber vollständig produktiv im Einsatz.

---

> 🇬🇧 **English:** Kudos Care is a maintenance-tracking app for bikes/motorcycles with Strava integration, built with Angular 21 (standalone components, signals, no NgModules) and Tailwind CSS v4. Log in via Strava OAuth, browse synced rides on an interactive map (MapLibre), and track component wear (chain, tires, brake pads, …) across all your bikes with weather-weighted `ok`/`warn`/`critical` status. Talks to the companion [Django backend](https://github.com/Marc-Schaar/kudos_care_backend) over session-cookie auth.

## Über das Projekt

Kudos Care ist das Angular-Frontend zur gleichnamigen Wartungs-Tracking-App für Fahrräder/Motorräder. Nach dem Login via Strava-OAuth zeigt das Dashboard alle Bikes samt Verschleiß-Status auf einen Blick, Aktivitäten lassen sich inklusive Route (MapLibre) und Wetter-Overlay im Detail ansehen, und pro Bike-Komponente kann der aktuelle Zustand geprüft und freigegeben werden. UI-Sprache ist durchgehend Deutsch.

Das Frontend spricht mit dem zugehörigen **[kudos_care_backend](https://github.com/Marc-Schaar/kudos_care_backend)** (Django/DRF) über eine reine Session-Cookie-Authentifizierung – kein JWT, keine Token-Logik im Client.

## ✨ Features

- **Strava-OAuth-Login** – Redirect-Flow, Callback-Verarbeitung, automatischer Session-Check via Route-Guard
- **Dashboard** – Bikes-Übersicht mit Sync-Status, kritischen/warnenden Komponenten und zuletzt gefahrenen Aktivitäten
- **Aktivitäten** – Liste und Detailansicht mit Karte (MapLibre GL), Wetter- und Gegenwind-Overlay pro Ride
- **Wartungs-Tracking** – Bikes, Component-Slots und Komponenten verwalten, Verschleiß-Status (`ok`/`warn`/`critical`/`unknown`) einsehen, Prüfungen protokollieren und freigeben
- **Live-Sync-Status** – Polling des laufenden Strava-Syncs mit Fortschrittsanzeige
- **Responsives Dark-Theme** als Default (Light-Theme-Override über `prefers-color-scheme`)

## 🛠️ Tech-Stack

| Bereich        | Technologie                                                    |
|-----------------|------------------------------------------------------------------|
| Framework       | Angular 21 (Standalone Components, keine NgModules), esbuild-Builder |
| Sprache         | TypeScript (strict mode, `strictTemplates`)                      |
| State           | Signals in `providedIn: 'root'`-Services, RxJS als Transport-Layer für HTTP/Timer |
| Styling         | Tailwind CSS v4 (via `@tailwindcss/postcss`)                      |
| Karten & Charts | MapLibre GL (Activity-Maps), Chart.js                            |
| Testing         | Vitest (`@angular/build:unit-test`)                               |
| Auth            | Session-Cookie (Django-CSRF via `withXsrfConfiguration`), kein JWT |
| Deployment      | GitHub Actions → Build → SCP auf Server → Nginx-Restart           |

## 🚀 Lokal starten

**Voraussetzungen:** Node.js 20+, npm, ein laufendes [kudos_care_backend](https://github.com/Marc-Schaar/kudos_care_backend) unter `http://localhost:8000`

```bash
git clone https://github.com/Marc-Schaar/kudos-care.git
cd kudos-care
npm install
npm start
```

Die App läuft anschließend unter `http://localhost:4200/` und spricht per Default mit dem Backend unter `http://localhost:8000/api` (siehe `src/environments/environment.ts`).

### Build

```bash
npm run build
```

Das Ergebnis liegt in `dist/kudos-care/browser/`.

### Tests

```bash
npm test
```

## 📁 Projektstruktur

```
src/app/
├── core/                 # Shell, Routing, Interceptors (Auth/Error)
├── features/
│   ├── app-login/        # Login, Strava-OAuth-Callback, authGuard
│   ├── app-dashboard/     # Bikes-Übersicht, Sync, Activities
│   ├── app-activity/      # Activity-Liste/-Detail, Karte, Wetter-Overlay
│   └── app-maintenance/   # Bikes, Component-Slots, Verschleiß-Tracking
└── shared/                # Toast-Notifications, gemeinsame Pipes/Services
```

## 👤 Kontakt

**Marc Schaar**
📧 [kontakt@marc-schaar.com](mailto:kontakt@marc-schaar.com) · 🌐 [marc-schaar.com](https://marc-schaar.com) · 💻 [GitHub](https://github.com/Marc-Schaar)

Dieses Projekt ist ein persönliches Side-Project, das im Alltag zur eigenen Fahrrad-/Motorrad-Wartung genutzt wird – gleichzeitig Teil meines Portfolios als Beispiel für modernes, signal-basiertes Angular ohne UI-Framework.
