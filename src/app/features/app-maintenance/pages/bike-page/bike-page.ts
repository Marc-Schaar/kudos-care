import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Icon } from '../../../../shared/components/icon/icon';
import { Skeleton } from '../../../../shared/components/skeleton/skeleton';
import { NavigationService } from '../../../../shared/services/navigation-service/navigation-service';
import { NotificationService } from '../../../../shared/services/notification-service/notification-service';
import { AddAssemblySheet } from '../../components/add-assembly-sheet/add-assembly-sheet';
import { BikeBlueprint } from '../../components/bike-blueprint/bike-blueprint';
import { BikeFormSheet } from '../../components/bike-form-sheet/bike-form-sheet';
import { BikeSetupStepperComponent } from '../../components/bike-setup-stepper-component/bike-setup-stepper-component';
import { DueRow } from '../../components/due-row/due-row';
import { IntervalSheet } from '../../components/interval-sheet/interval-sheet';
import { LinksSheet } from '../../components/links-sheet/links-sheet';
import { PartSheet } from '../../components/part-sheet/part-sheet';
import { RadKeller } from '../../components/rad-keller/rad-keller';
import { SwitchSheet } from '../../components/switch-sheet/switch-sheet';
import { WearLegend } from '../../components/wear-meter/wear-meter';
import { WheelsetSheet } from '../../components/wheelset-sheet/wheelset-sheet';
import {
  AssembliesResponse,
  BikeAssembly,
  BikeComponent,
  ComponentSlot,
  MaintenanceInterval,
} from '../../models/maintenance.models';
import { WarnClassPipe } from '../../pipes/warn-class/warn-class-pipe';
import { WarnLabelPipe } from '../../pipes/warn-label/warn-label-pipe';
import { BikeService } from '../../services/bike-service/bike-service';
import {
  BoardEntry,
  buildBoard,
  buildDueList,
  DueItem,
  partsLabel,
  relevantDue,
} from '../../shared/utils/utils';

/**
 * Wie viele Posten "Als Nächstes dran" zunächst zeigt. Die Liste steht neben den Baugruppen
 * und soll sie nicht aus dem Bild schieben.
 */
const DUE_LIMIT = 3;

interface OpenPart {
  component: BikeComponent;
  slot: ComponentSlot;
  assembly: BikeAssembly | null;
}

/**
 * Ein Rad auf einer Seite: die Zeichnung, darunter Rad | Keller mit dem Wechsel, was als
 * Nächstes ansteht und die übrigen Baugruppen. Eine Baugruppe hat ihre eigene Seite; alles andere geht
 * direkt hier in einem Blatt auf.
 */
@Component({
  selector: 'app-bike-page',
  imports: [
    AddAssemblySheet,
    BikeBlueprint,
    BikeFormSheet,
    BikeSetupStepperComponent,
    DatePipe,
    DecimalPipe,
    DueRow,
    Icon,
    IntervalSheet,
    LinksSheet,
    PartSheet,
    RadKeller,
    RouterLink,
    Skeleton,
    SwitchSheet,
    WarnClassPipe,
    WarnLabelPipe,
    WearLegend,
    WheelsetSheet,
  ],
  templateUrl: './bike-page.html',
  styleUrl: './bike-page.css',
})
export class BikePage {
  readonly nav = inject(NavigationService);
  private readonly route = inject(ActivatedRoute);
  private readonly bikeService = inject(BikeService);
  private readonly notifications = inject(NotificationService);

  bikeId = signal(0);
  garage = signal<AssembliesResponse | null>(null);
  loading = signal(true);
  setupDismissed = signal(false);
  showRetired = signal(false);
  showAllDue = signal(false);
  readonly partsLabel = partsLabel;

  // Offene Blätter
  editingBike = signal(false);
  addingSet = signal(false);
  addingAssembly = signal(false);
  openPart = signal<OpenPart | null>(null);
  switching = signal<BoardEntry | null>(null);
  linkingWheels = signal<BikeAssembly[] | null>(null);
  editingInterval = signal<MaintenanceInterval | null>(null);

  // KI-Zustandsbericht, erst auf Klick: die Generierung kostet einen AI-Call.
  report = signal<{ text: string; generatedAt: string } | null>(null);
  reportLoading = signal(false);

  /** `selectedBike` überlebt Seitenwechsel: das vorige Rad darf hier nicht aufblitzen. */
  bike = computed(() => {
    const bike = this.bikeService.selectedBike();
    return bike?.id === this.bikeId() ? bike : null;
  });

  private live = computed(() => {
    const garage = this.garage();
    return garage ? [...garage.assemblies, ...garage.parked_assemblies] : [];
  });

  needsSetup = computed(
    () =>
      !this.setupDismissed() &&
      this.garage() !== null &&
      this.live().length === 0 &&
      this.garage()!.ungrouped_slots.length === 0,
  );

  board = computed(() =>
    buildBoard(this.garage()?.assemblies ?? [], this.garage()?.parked_assemblies ?? []),
  );

  areas = computed(() =>
    (this.garage()?.assemblies ?? []).filter((assembly) => assembly.group_detail.kind === 'area'),
  );

  /** Was am Rad ist, nach verbrauchter Lebensdauer. */
  private allDue = computed(() => buildDueList(this.garage()?.assemblies ?? []));

  private relevantDue = computed(() => relevantDue(this.allDue()));

  due = computed(() =>
    this.showAllDue() ? this.relevantDue() : this.relevantDue().slice(0, DUE_LIMIT),
  );

  hiddenDueCount = computed(() => this.relevantDue().length - this.due().length);

  criticalCount = computed(() => this.allDue().filter((i) => i.status === 'critical').length);
  warnCount = computed(() => this.allDue().filter((i) => i.status === 'warn').length);

  /** Gute Teile, deren Laufrad ausgemustert wurde: die brauchen einen neuen Platz. */
  orphans = computed(() => (this.garage()?.spare_components ?? []).filter((s) => s.orphaned));

  retired = computed(() => this.garage()?.retired_assemblies ?? []);
  ungrouped = computed(() => this.garage()?.ungrouped_slots ?? []);

  /** Die Namen der gekoppelten Teile — die Sätze zeigen, was mitwechselt. */
  partLabels = computed(() => {
    const labels = new Map<number, string>();
    for (const assembly of this.live()) {
      for (const slot of assembly.slots) {
        for (const part of [
          ...(slot.mounted_component ? [slot.mounted_component] : []),
          ...slot.spare_components,
        ]) {
          labels.set(part.id, part.label);
        }
      }
    }
    return labels;
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.bikeId.set(Number(params.get('id')));
      this.garage.set(null);
      this.report.set(null);
      this.loading.set(true);
      this.reload();
    });
  }

  reload() {
    forkJoin([
      this.bikeService.fetchBikeDetails(this.bikeId()),
      this.bikeService.fetchAssemblies(this.bikeId()),
    ]).subscribe({
      next: ([, garage]) => {
        this.garage.set(garage);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** Nach jeder Aktion: Blätter zu, Zahlen neu. */
  afterChange() {
    this.openPart.set(null);
    this.switching.set(null);
    this.linkingWheels.set(null);
    this.editingInterval.set(null);
    this.addingAssembly.set(false);
    this.editingBike.set(false);
    this.report.set(null);
    this.reload();
  }

  openDue(item: DueItem) {
    if (item.component && item.slot) {
      this.openPart.set({ component: item.component, slot: item.slot, assembly: item.assembly });
    } else if (item.interval) {
      this.editingInterval.set(item.interval);
    }
  }

  markDone(interval: MaintenanceInterval) {
    this.bikeService.logInterval(interval.id).subscribe(() => {
      this.notifications.show(`${interval.label}: erledigt.`, 'success');
      this.reload();
    });
  }

  openOrphan(spareId: number) {
    for (const assembly of this.retired()) {
      for (const slot of assembly.slots) {
        const component = slot.spare_components.find((part) => part.id === spareId);
        if (component) {
          this.openPart.set({ component, slot, assembly });
          return;
        }
      }
    }
  }

  openUngrouped(slot: ComponentSlot) {
    if (slot.mounted_component) {
      this.openPart.set({ component: slot.mounted_component, slot, assembly: null });
    }
  }

  restore(assembly: BikeAssembly) {
    this.bikeService.restoreAssembly(assembly.id).subscribe(() => {
      this.notifications.show(`${assembly.display_name} ist zurück.`, 'success');
      this.reload();
    });
  }

  onSetCreated(wheels: BikeAssembly[]) {
    this.addingSet.set(false);
    // Frisch geladen fragen, was mitwechselt: die neuen Laufräder stehen erst danach im Stand.
    this.bikeService.fetchAssemblies(this.bikeId()).subscribe((garage) => {
      this.garage.set(garage);
      const ids = new Set(wheels.map((wheel) => wheel.id));
      const fresh = [...garage.assemblies, ...garage.parked_assemblies].filter((assembly) =>
        ids.has(assembly.id),
      );
      const hasPads = garage.assemblies.some((assembly) =>
        assembly.slots.some((slot) => slot.template_detail.follows_wheel),
      );
      if (hasPads && fresh.length > 0) this.linkingWheels.set(fresh);
    });
  }

  onSwitchWantsLinks(entry: BoardEntry) {
    this.switching.set(null);
    this.linkingWheels.set(entry.members);
  }

  onBikeDeleted() {
    this.editingBike.set(false);
    this.nav.goTo(this.nav.to.bikes());
  }

  loadReport(refresh = false) {
    this.reportLoading.set(true);
    this.bikeService.fetchConditionReport(this.bikeId(), refresh).subscribe({
      next: (res) => {
        this.report.set({ text: res.report, generatedAt: res.generated_at });
        this.reportLoading.set(false);
      },
      error: () => this.reportLoading.set(false),
    });
  }
}
