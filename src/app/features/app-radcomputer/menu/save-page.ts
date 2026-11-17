import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { NavigationService } from '../../../shared/services/navigation-service/navigation-service';
import { fmtTime, num } from '../core/format';
import { RC } from '../core/paths';
import { RideRecorder } from '../core/ride-recorder';
import { RouteShape, SHAPE_H, SHAPE_W, defaultRideName, routeShape } from '../core/ride-summary';
import { RideSync, UploadDraft, emptyDraft } from '../core/ride-sync';
import { store } from '../core/storage';
import { ActivityTags, KudosBike, RideSportType, Strava } from '../core/strava';
import { Toasts } from '../core/toasts';
import { SubHeader } from './sub-header';

/** So lange bleibt „Verwerfen“ nach dem ersten Tippen scharf. */
const DISCARD_ARM_MS = 4000;
/** Zuletzt gewähltes Rad: Wer pendelt, fährt fast immer dasselbe. Nur eine Bequemlichkeit. */
const LAST_BIKE_KEY = 'radcomputer.lastBike';

export const SPORT_TYPES: readonly { value: RideSportType; label: string }[] = [
  { value: 'Ride', label: 'Radfahrt' },
  { value: 'GravelRide', label: 'Gravel' },
  { value: 'MountainBikeRide', label: 'Mountainbike' },
  { value: 'EBikeRide', label: 'E-Bike' },
  { value: 'EMountainBikeRide', label: 'E-Mountainbike' },
  { value: 'VirtualRide', label: 'Virtuell (Rolle mit App)' },
];

/** Radtyp aus Kudos Care → passende Strava-Art, solange man sie nicht selbst wählt. */
const SPORT_BY_BIKE_TYPE: Record<string, RideSportType> = {
  gravel: 'GravelRide',
  cx: 'GravelRide',
  mtb: 'MountainBikeRide',
  ebike_road: 'EBikeRide',
  ebike_city: 'EBikeRide',
  ebike_mtb: 'EMountainBikeRide',
};

type TagKey = 'commute' | 'trainer' | 'hideFromHome';

const TAG_OPTIONS: readonly { key: TagKey; label: string }[] = [
  { key: 'commute', label: 'Pendelfahrt' },
  { key: 'trainer', label: 'Rolle' },
  { key: 'hideFromHome', label: 'Nicht im Feed' },
];

interface Facts {
  time: string;
  km: string;
  ascent: string;
  extra: string;
}

/** Was nach dem Speichern stehen bleibt, obwohl die Fahrt schon zurückgesetzt ist. */
interface DoneSummary {
  headline: string;
  name: string;
  when: string;
  route: RouteShape | null;
  facts: Facts;
  tags: string[];
  activityId: number | null;
  notice: string | null;
}

/**
 * Fahrt zu Strava senden, als Datei exportieren oder verwerfen.
 *
 * Aufbau nach Gewicht: oben die eigene Strecke und die Zahlen, dann Titel, Rad, Art und
 * Tags, genau eine Hauptaktion (Strava), darunter der Export, ganz unten und abgesetzt das
 * Verwerfen. Nach dem Senden bleibt die Seite stehen und zeigt, was gespeichert wurde —
 * vorher sprang sie mit einer Meldung auf die leere Fahrtseite zurück.
 */
@Component({
  selector: 'rc-save-page',
  imports: [SubHeader, RouterLink],
  templateUrl: './save-page.html',
  styleUrl: './save-page.css',
})
export class SavePage {
  protected readonly ride = inject(RideRecorder);
  protected readonly sync = inject(RideSync);
  protected readonly strava = inject(Strava);
  protected readonly kudos = inject(NavigationService);
  private readonly toasts = inject(Toasts);
  private readonly router = inject(Router);

  protected readonly viewBox = `0 0 ${SHAPE_W} ${SHAPE_H}`;
  protected readonly armMs = DISCARD_ARM_MS;
  protected readonly sportTypes = SPORT_TYPES;
  protected readonly tagOptions = TAG_OPTIONS;
  protected readonly exported = signal(false);
  protected readonly uploadError = signal<string | null>(null);
  protected readonly discardArmed = signal(false);
  protected readonly done = signal<DoneSummary | null>(null);
  protected readonly bikes = signal<KudosBike[]>([]);
  protected readonly draft = this.sync.draft;
  private discardTimer: ReturnType<typeof setTimeout> | null = null;

  /** Hängt an `trackLength`, weil der Track selbst bewusst kein Signal ist. */
  protected readonly route = computed(() => {
    this.ride.trackLength();
    return routeShape(this.ride.snapshot().track);
  });

  protected readonly suggestedName = computed(() => defaultRideName(this.ride.stats().startedAt));

  protected readonly facts = computed<Facts>(() => {
    const stats = this.ride.stats();
    const laps = this.ride.laps().length;
    const extra: string[] = [];
    if (laps > 1) extra.push(`${laps} Runden`);
    if (stats.pwrN > 0) extra.push(`Ø ${Math.round(stats.pwrSum / stats.pwrN)} W`);
    return {
      time: fmtTime(stats.movingMs),
      km: num(stats.distanceM / 1000, 2),
      ascent: num(stats.ascentM, 0),
      extra: extra.join(', '),
    };
  });

  protected readonly sendLabel = computed(() => {
    switch (this.sync.phase()) {
      case 'sending':
        return 'Sendet …';
      case 'processing':
        return 'Strava verarbeitet …';
      case 'tagging':
        return 'Rad und Art setzen …';
      default:
        return 'Zu Strava senden';
    }
  });

  constructor() {
    void this.loadBikes();
  }

  private async loadBikes(): Promise<void> {
    try {
      const bikes = await this.strava.bikes();
      this.bikes.set(bikes);
      // Zuletzt benutztes Rad vorschlagen, solange es noch existiert und nichts gewählt ist.
      const last = store.get<string>(LAST_BIKE_KEY);
      const bike = bikes.find((b) => b.strava_bike_id === last);
      if (bike && !this.draft().gearId) this.applyBike(bike);
    } catch {
      // Ohne Netz oder ohne Räder: Strava nimmt sein Standardrad.
      this.bikes.set([]);
    }
  }

  protected setText(key: 'name' | 'description', event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.draft.update((d) => ({ ...d, [key]: value }));
  }

  protected setBike(event: Event): void {
    const gearId = (event.target as HTMLSelectElement).value;
    const bike = this.bikes().find((b) => b.strava_bike_id === gearId);
    if (bike) this.applyBike(bike);
    else this.draft.update((d) => ({ ...d, gearId: '' }));
  }

  private applyBike(bike: KudosBike): void {
    this.draft.update((d) => ({
      ...d,
      gearId: bike.strava_bike_id ?? '',
      sportType: d.sportTypeChosen ? d.sportType : (SPORT_BY_BIKE_TYPE[bike.bike_type] ?? 'Ride'),
    }));
  }

  protected setSportType(event: Event): void {
    const sportType = (event.target as HTMLSelectElement).value as RideSportType;
    this.draft.update((d) => ({ ...d, sportType, sportTypeChosen: true }));
  }

  protected toggleTag(key: TagKey): void {
    this.draft.update((d) => ({ ...d, [key]: !d[key] }));
  }

  protected async exportFile(): Promise<void> {
    const result = await this.sync.share();
    if (result === 'empty') this.toasts.show('Noch nichts aufgezeichnet.');
    if (result === 'downloaded') this.toasts.show('Fahrt als TCX-Datei gespeichert.');
    // Nach einem Export nicht sofort beenden: Wer will, lädt dieselbe Fahrt noch zu Strava.
    if (result === 'downloaded' || result === 'shared') this.exported.set(true);
  }

  /** Ist die Fahrt auf Strava, ist sie abgeschlossen: Ergebnis zeigen, Fahrt zurücksetzen. */
  protected async upload(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.ride.hasData() || this.sync.uploading()) return;
    const d = this.draft();
    const name = d.name.trim() || this.suggestedName();
    this.uploadError.set(null);
    try {
      const outcome = await this.sync.upload({
        name,
        description: d.description,
        commute: d.commute,
        trainer: d.trainer,
        tags: tagsFor(d),
      });
      if (d.gearId) store.set(LAST_BIKE_KEY, d.gearId);
      this.complete(true, {
        headline: outcome.activityId ? 'Auf Strava gespeichert' : 'Hochgeladen',
        name,
        activityId: outcome.activityId,
        notice:
          outcome.tagsProblem ??
          (outcome.activityId ? null : 'Strava verarbeitet die Fahrt noch. Sie erscheint gleich.'),
      });
    } catch (err) {
      this.uploadError.set(err instanceof Error ? err.message : 'Upload fehlgeschlagen.');
    }
  }

  /** Nach dem Export ohne Strava abschließen. */
  protected finishLocal(): void {
    this.complete(false, {
      headline: 'Als Datei gesichert',
      name: this.draft().name.trim() || this.suggestedName(),
      activityId: null,
      notice: null,
    });
  }

  private complete(
    uploaded: boolean,
    result: Pick<DoneSummary, 'headline' | 'name' | 'activityId' | 'notice'>,
  ): void {
    const d = this.draft();
    const startedAt = this.ride.stats().startedAt;
    this.done.set({
      ...result,
      when: startedAt
        ? new Date(startedAt).toLocaleString('de-DE', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '',
      route: this.route(),
      facts: this.facts(),
      tags: uploaded ? this.tagLabels(d) : [],
    });
    this.ride.reset();
    this.exported.set(false);
    this.uploadError.set(null);
    this.draft.set(emptyDraft());
  }

  private tagLabels(d: UploadDraft): string[] {
    const labels: string[] = [];
    const bike = this.bikes().find((b) => b.strava_bike_id === d.gearId);
    if (bike) labels.push(bike.name);
    if (d.sportType !== 'Ride') {
      labels.push(SPORT_TYPES.find((t) => t.value === d.sportType)?.label ?? d.sportType);
    }
    for (const tag of TAG_OPTIONS) if (d[tag.key]) labels.push(tag.label);
    return labels;
  }

  protected newRide(): void {
    this.done.set(null);
    void this.router.navigateByUrl(RC.ride);
  }

  /** Zweistufig statt Rückfrage-Dialog: Der fehlt in manchen eingebetteten Browsern. */
  protected discard(): void {
    if (!this.discardArmed()) {
      this.discardArmed.set(true);
      this.discardTimer = setTimeout(() => this.discardArmed.set(false), DISCARD_ARM_MS);
      return;
    }
    if (this.discardTimer) clearTimeout(this.discardTimer);
    this.discardArmed.set(false);
    this.exported.set(false);
    this.uploadError.set(null);
    this.draft.set(emptyDraft());
    this.ride.reset();
    this.toasts.show('Fahrt verworfen.');
  }
}

/** Nur was vom Standard abweicht, geht an Strava. */
export function tagsFor(d: UploadDraft): ActivityTags {
  const tags: ActivityTags = {};
  if (d.sportType !== 'Ride') tags.sport_type = d.sportType;
  if (d.gearId) tags.gear_id = d.gearId;
  if (d.hideFromHome) tags.hide_from_home = true;
  return tags;
}
