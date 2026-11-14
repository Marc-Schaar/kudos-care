import { Injectable, inject, signal } from '@angular/core';

import { AudioFeedback } from '../core/audio-feedback';
import { clamp, speakDistance } from '../core/format';
import { Gps } from '../core/gps';
import { GpsFix, Place } from '../core/models';
import { Toasts } from '../core/toasts';
import { parseGpx } from './gpx';
import { NavProgress, NavRoute } from './nav-models';
import { buildRoute, matchRoute } from './route-builder';
import { RoutePlanner } from './route-planner';

/** Ab diesem Abstand gilt die Route als verlassen (m), nach so vielen Positionen in Folge. */
const OFF_ROUTE_M = 40;
const OFF_ROUTE_FIXES = 5;
/** Frühestens so oft wird neu geroutet (ms). */
const REROUTE_EVERY_MS = 30000;

const lowerFirst = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);

/** Führt entlang einer Route: Fortschritt, nächster Hinweis, Ansagen, Neuberechnung. */
@Injectable({ providedIn: 'root' })
export class RouteGuide {
  private readonly gps = inject(Gps);
  private readonly audio = inject(AudioFeedback);
  private readonly planner = inject(RoutePlanner);
  private readonly toasts = inject(Toasts);

  /** Je Hinweis: 0 = nichts gesagt, 1 = Vorankündigung, 2 = „jetzt“. */
  private readonly said = new Map<number, number>();
  private matchIndex = 0;
  private offCount = 0;
  private offAnnounced = false;
  private arrived = false;
  private lastRerouteAt = 0;
  /** Zählt Routenwechsel, damit eine verspätete Antwort keine neuere Wahl überschreibt. */
  private generation = 0;

  readonly route = signal<NavRoute | null>(null);
  readonly progress = signal<NavProgress | null>(null);
  readonly busy = signal(false);

  constructor() {
    this.gps.onFix((fix) => this.onFix(fix));
  }

  setRoute(route: NavRoute | null): void {
    this.generation += 1;
    this.said.clear();
    this.matchIndex = 0;
    this.offCount = 0;
    this.offAnnounced = false;
    this.arrived = false;
    this.route.set(route);
    this.progress.set(null);
    const fix = this.gps.position();
    if (route && fix) this.onFix(fix);
  }

  clear(): void {
    this.setRoute(null);
  }

  async loadGpx(file: File): Promise<boolean> {
    return this.loadGpxText(await file.text(), file.name.replace(/\.gpx$/i, ''));
  }

  /** Lädt eine Route aus GPX-Text, etwa aus einer Datei oder von Strava. */
  loadGpxText(xml: string, fallbackName: string): boolean {
    try {
      const gpx = parseGpx(xml, fallbackName);
      this.setRoute(buildRoute(gpx.name, gpx.coords));
      this.audio.say(`Route geladen: ${gpx.name}`);
      return true;
    } catch (err) {
      this.toasts.show(
        err instanceof Error ? err.message : 'Die GPX-Datei konnte nicht gelesen werden.',
      );
      return false;
    }
  }

  /** Zielführung vom aktuellen Standort. */
  async navigateTo(place: Place, announce = true): Promise<boolean> {
    const from = this.gps.position() ?? this.gps.fix();
    if (!from) {
      this.gps.start();
      this.toasts.show('Noch kein Standort. Warte auf GPS und versuche es dann erneut.');
      return false;
    }
    this.busy.set(true);
    const generation = this.generation;
    try {
      const route = await this.planner.plan(from, place);
      if (generation !== this.generation) return false; // inzwischen wurde etwas anderes gewählt oder beendet
      this.setRoute(route);
      if (announce)
        this.audio.say(
          `Route berechnet: ${speakDistance(this.route()!.lengthM, false)} bis ${place.name.split(',')[0]}`,
        );
      return true;
    } catch (err) {
      this.toasts.show(
        err instanceof Error ? err.message : 'Die Route konnte nicht berechnet werden.',
      );
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  private onFix(fix: GpsFix): void {
    const route = this.route();
    if (!route) return;
    const match = matchRoute(route.points, fix.lat, fix.lon, this.matchIndex);
    this.matchIndex = match.index;

    this.offCount = match.offM > OFF_ROUTE_M ? this.offCount + 1 : 0;
    const offRoute = this.offCount >= OFF_ROUTE_FIXES;
    const remainingM = Math.max(0, route.lengthM - match.alongM);
    if (!offRoute && remainingM < 25) this.arrived = true;

    const nextCue = route.cues.find((c) => c.dist > match.alongM - 8) ?? null;
    const progress: NavProgress = {
      index: match.index,
      alongM: match.alongM,
      offM: match.offM,
      remainingM,
      nextCue,
      cueDistM: nextCue ? Math.max(0, nextCue.dist - match.alongM) : null,
      offRoute,
      arrived: this.arrived,
    };
    this.progress.set(progress);
    this.announce(route, progress, fix.speed ?? 0);
  }

  private announce(route: NavRoute, p: NavProgress, speed: number): void {
    if (p.offRoute) {
      if (!this.offAnnounced) {
        this.offAnnounced = true;
        this.audio.say('Route verlassen', { tone: 'alert', urgent: true });
      }
      void this.maybeReroute(route);
      return;
    }
    if (this.offAnnounced && p.offM < OFF_ROUTE_M / 2) {
      this.offAnnounced = false;
      this.audio.say('Wieder auf der Route');
    }

    const cue = p.nextCue;
    if (!cue || p.cueDistM == null) return;
    // Je schneller, desto früher: Vorankündigung rund 20 s, „jetzt“ rund 4 s vorher.
    const far = clamp(speed * 20, 150, 400);
    const near = clamp(speed * 4, 25, 60);
    const state = this.said.get(cue.index) ?? 0;
    if (state < 2 && p.cueDistM <= near) {
      this.said.set(cue.index, 2);
      this.audio.say(cue.kind === 'arrive' ? 'Ziel erreicht' : `Jetzt ${lowerFirst(cue.text)}`, {
        tone: 'go',
        urgent: true,
      });
    } else if (state < 1 && p.cueDistM <= far && p.cueDistM > near * 1.5) {
      this.said.set(cue.index, 1);
      const dist = speakDistance(p.cueDistM);
      this.audio.say(
        cue.kind === 'arrive' ? `Ziel in ${dist}` : `In ${dist} ${lowerFirst(cue.text)}`,
      );
    }
  }

  /** Nur bei Zielführung: Neue Route vom aktuellen Standort, wenn die alte verlassen wurde. */
  private async maybeReroute(route: NavRoute): Promise<void> {
    const now = Date.now();
    if (
      !route.destination ||
      this.busy() ||
      this.offCount < OFF_ROUTE_FIXES * 2 ||
      now - this.lastRerouteAt < REROUTE_EVERY_MS
    )
      return;
    this.lastRerouteAt = now;
    if (await this.navigateTo(route.destination, false)) this.audio.say('Route neu berechnet');
  }
}
