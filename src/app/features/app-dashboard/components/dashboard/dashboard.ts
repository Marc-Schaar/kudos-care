import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, Observable, of, switchMap } from 'rxjs';
import { Icon } from '../../../../shared/components/icon/icon';
import { Skeleton } from '../../../../shared/components/skeleton/skeleton';
import { NavigationService } from '../../../../shared/services/navigation-service/navigation-service';
import { NotificationService } from '../../../../shared/services/notification-service/notification-service';
import { StravaService } from '../../../../shared/services/strava-service/strava-service';
import { RideRow } from '../../../app-activity/components/ride-row/ride-row';
import { RideTally } from '../../../app-activity/components/ride-tally/ride-tally';
import { BikeBlueprint } from '../../../app-maintenance/components/bike-blueprint/bike-blueprint';
import { DueRow } from '../../../app-maintenance/components/due-row/due-row';
import { WearLegend } from '../../../app-maintenance/components/wear-meter/wear-meter';
import {
  AssembliesResponse,
  BikeList,
  MaintenanceInterval,
} from '../../../app-maintenance/models/maintenance.models';
import { WarnClassPipe } from '../../../app-maintenance/pipes/warn-class/warn-class-pipe';
import { BikeService } from '../../../app-maintenance/services/bike-service/bike-service';
import {
  buildDueList,
  DueItem,
  relevantDue,
} from '../../../app-maintenance/shared/utils/utils';
import { buildVerdict, BikeDue } from './verdict';

/** Wie viele Posten die Startseite zeigt. Alles Weitere liegt auf der Rad-Seite. */
const DUE_LIMIT = 4;
const RECENT_RIDES = 5;

/**
 * Die Seite nach dem Login. Beantwortet zuerst die Frage, wegen der man die App öffnet, in einem
 * Satz: muss ich mich um etwas kümmern? Darunter das Rad als Zeichnung, dann die Reihenfolge.
 *
 * Lädt dafür je aktivem Rad den Stand der Baugruppen. Die Bike-Liste allein kennt nur eine Ampel
 * je Rad, und daraus lässt sich kein Satz bilden. Ein Rad, dessen Stand nicht lädt, fällt nicht
 * ins Gewicht: die übrigen sollen trotzdem erscheinen.
 */
@Component({
  selector: 'app-dashboard',
  imports: [
    BikeBlueprint,
    DatePipe,
    DecimalPipe,
    DueRow,
    Icon,
    RideRow,
    RideTally,
    RouterLink,
    Skeleton,
    WarnClassPipe,
    WearLegend,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  readonly nav = inject(NavigationService);
  private stravaService = inject(StravaService);
  private bikeService = inject(BikeService);
  private notifications = inject(NotificationService);

  public user = this.stravaService.user;
  public activities = this.stravaService.activities;
  public syncing = this.stravaService.syncing;
  public syncProgress = this.stravaService.syncProgress;

  readonly today = new Date();

  /** Null, solange die Räder noch laden: dann gibt es noch keinen Befund, auch keinen leeren. */
  private garages = signal<Map<number, AssembliesResponse> | null>(null);
  public ridesLoading = signal(true);
  public loading = computed(() => this.garages() === null);

  /** Das vom Nutzer gewählte Rad. Ohne Wahl steht das dringendste in der Zeichnung. */
  private chosenBikeId = signal<number | null>(null);

  private wasSyncing = false;

  public activeBikes = computed(() => this.bikeService.bikes().filter((bike) => !bike.retired));

  private entries = computed<BikeDue[]>(() => {
    const garages = this.garages();
    return this.activeBikes().map((bike) => ({
      bike,
      due: buildDueList(garages?.get(bike.id)?.assemblies ?? []),
    }));
  });

  public verdict = computed(() => buildVerdict(this.entries()));

  public focusBike = computed<BikeList | null>(() => {
    const bikes = this.activeBikes();
    const chosen = bikes.find((bike) => bike.id === this.chosenBikeId());
    if (chosen) return chosen;
    const ranked = [...this.entries()].sort(
      (a, b) => (b.due[0]?.ratio ?? -1) - (a.due[0]?.ratio ?? -1),
    );
    return ranked[0]?.bike ?? null;
  });

  public focusAssemblies = computed(() => {
    const bike = this.focusBike();
    return (bike && this.garages()?.get(bike.id)?.assemblies) || [];
  });

  private focusDue = computed(() => relevantDue(buildDueList(this.focusAssemblies())));
  public due = computed(() => this.focusDue().slice(0, DUE_LIMIT));
  public moreDue = computed(() => this.focusDue().length - this.due().length);

  public recentRides = computed(() =>
    [...this.activities()]
      .sort((a, b) => Date.parse(b.start_date ?? '') - Date.parse(a.start_date ?? ''))
      .slice(0, RECENT_RIDES),
  );

  constructor() {
    effect(() => {
      const syncing = this.syncing();
      if (this.wasSyncing && !syncing) this.reload();
      this.wasSyncing = syncing;
    });
  }

  ngOnInit() {
    this.reload();
    this.stravaService.fetchActivities().subscribe({
      complete: () => this.ridesLoading.set(false),
      error: () => this.ridesLoading.set(false),
    });
    this.stravaService.checkOngoingSync().subscribe();
  }

  private reload() {
    this.bikeService
      .fetchBikes()
      .pipe(
        switchMap((bikes) => {
          const active = bikes.filter((bike) => !bike.retired);
          return active.length ? forkJoin(active.map((bike) => this.loadGarage(bike))) : of([]);
        }),
        map((pairs) => new Map(pairs.filter((pair): pair is [number, AssembliesResponse] => !!pair[1]))),
      )
      .subscribe({
        next: (garages) => this.garages.set(garages),
        error: () => this.garages.set(new Map()),
      });
  }

  private loadGarage(bike: BikeList): Observable<[number, AssembliesResponse | null]> {
    return this.bikeService.fetchAssemblies(bike.id).pipe(
      map((garage): [number, AssembliesResponse | null] => [bike.id, garage]),
      catchError(() => of<[number, null]>([bike.id, null])),
    );
  }

  public chooseBike(bike: BikeList) {
    this.chosenBikeId.set(bike.id);
  }

  public dueLink(item: DueItem) {
    const bike = this.focusBike();
    return bike ? this.nav.to.assembly(bike.id, item.assembly.id) : null;
  }

  public markDone(interval: MaintenanceInterval) {
    this.bikeService.logInterval(interval.id).subscribe(() => {
      this.notifications.show(`${interval.label}: erledigt.`, 'success');
      this.reload();
    });
  }

  public syncNow() {
    this.stravaService.triggerSync().subscribe();
  }

  public cancelSync() {
    this.stravaService.cancelSync().subscribe();
  }
}
