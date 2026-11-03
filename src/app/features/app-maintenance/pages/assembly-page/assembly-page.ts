import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Icon } from '../../../../shared/components/icon/icon';
import { Skeleton } from '../../../../shared/components/skeleton/skeleton';
import { NavigationService } from '../../../../shared/services/navigation-service/navigation-service';
import { NotificationService } from '../../../../shared/services/notification-service/notification-service';
import { AddItemSheet } from '../../components/add-item-sheet/add-item-sheet';
import { AssemblySettingsSheet } from '../../components/assembly-settings-sheet/assembly-settings-sheet';
import { BottomSheet } from '../../components/bottom-sheet/bottom-sheet';
import { IntervalSheet } from '../../components/interval-sheet/interval-sheet';
import { LinksSheet } from '../../components/links-sheet/links-sheet';
import { PartForm } from '../../components/part-form/part-form';
import { PartSheet } from '../../components/part-sheet/part-sheet';
import { SlotSheet } from '../../components/slot-sheet/slot-sheet';
import { SwitchSheet } from '../../components/switch-sheet/switch-sheet';
import { WearLegend, WearMeter } from '../../components/wear-meter/wear-meter';
import {
  AssembliesResponse,
  BikeAssembly,
  BikeComponent,
  ComponentSlot,
  MaintenanceInterval,
} from '../../models/maintenance.models';
import { WarnClassPipe } from '../../pipes/warn-class/warn-class-pipe';
import { BikeService } from '../../services/bike-service/bike-service';
import { partRemaining } from '../../shared/utils/utils';

/**
 * Eine Baugruppe: je Platz das montierte Teil und die Alternativen im Regal. Aufziehen ist
 * ein Tipp, denn das ist der häufigste Handgriff (Reifen A runter, Reifen B drauf).
 *
 * Lädt den Stand des ganzen Rads statt nur der Baugruppe: das Blatt zum Umziehen und die
 * Kopplungen brauchen die anderen Baugruppen sowieso.
 */
@Component({
  selector: 'app-assembly-page',
  imports: [
    AddItemSheet,
    AssemblySettingsSheet,
    BottomSheet,
    DatePipe,
    DecimalPipe,
    Icon,
    IntervalSheet,
    LinksSheet,
    PartForm,
    PartSheet,
    RouterLink,
    Skeleton,
    SlotSheet,
    SwitchSheet,
    WarnClassPipe,
    WearLegend,
    WearMeter,
  ],
  templateUrl: './assembly-page.html',
  styleUrl: './assembly-page.css',
})
export class AssemblyPage {
  readonly nav = inject(NavigationService);
  private readonly route = inject(ActivatedRoute);
  private readonly bikeService = inject(BikeService);
  private readonly notifications = inject(NotificationService);

  bikeId = signal(0);
  assemblyId = signal(0);
  garage = signal<AssembliesResponse | null>(null);
  loading = signal(true);
  busy = signal(false);
  /** Plätze, deren ausgemusterte Teile aufgeklappt sind. */
  expanded = signal<ReadonlySet<number>>(new Set());
  /** Gerade auf "Erledigt" getippt: bietet das Zurücknehmen an Ort und Stelle an. */
  justDone = signal<number | null>(null);

  // Offene Blätter
  openPart = signal<{ component: BikeComponent; slot: ComponentSlot } | null>(null);
  addingPartTo = signal<{ slot: ComponentSlot; mount: boolean } | null>(null);
  editingSlot = signal<ComponentSlot | null>(null);
  editingInterval = signal<MaintenanceInterval | null>(null);
  addingInterval = signal(false);
  addingItem = signal(false);
  switching = signal(false);
  linking = signal(false);
  settingsOpen = signal(false);
  readonly remaining = partRemaining;

  /** Aus dem Menü eines Platzes: dessen Blatt schließt, das Teile-Formular geht auf. */
  onAddPart(slot: ComponentSlot) {
    this.editingSlot.set(null);
    this.addingPartTo.set({ slot, mount: !slot.mounted_component });
  }

  bikeName = computed(() => {
    const bike = this.bikeService.selectedBike();
    return bike?.id === this.bikeId() ? bike.name : 'Zurück';
  });

  assembly = computed<BikeAssembly | null>(() => {
    const garage = this.garage();
    if (!garage) return null;
    return (
      [...garage.assemblies, ...garage.parked_assemblies, ...garage.retired_assemblies].find(
        (assembly) => assembly.id === this.assemblyId(),
      ) ?? null
    );
  });

  isWheel = computed(() => this.assembly()?.group_detail.kind === 'assembly');

  /** Seit wann die Baugruppe am Rad ist: der Beginn des laufenden Zeitraums. */
  onBikeSince = computed(() => {
    const periods = this.assembly()?.periods ?? [];
    return periods.find((period) => period.ended_at === null)?.started_at ?? null;
  });

  linkedParts = computed(() => {
    const assembly = this.assembly();
    const garage = this.garage();
    if (!assembly || !garage) return [];
    const labels: string[] = [];
    for (const other of [...garage.assemblies, ...garage.parked_assemblies]) {
      if (assembly.linked_assembly_ids.includes(other.id)) labels.push(other.display_name);
      for (const slot of other.slots) {
        for (const part of [
          ...(slot.mounted_component ? [slot.mounted_component] : []),
          ...slot.spare_components,
        ]) {
          if (assembly.linked_component_ids.includes(part.id)) {
            labels.push(`${slot.display_name}: ${part.label}`);
          }
        }
      }
    }
    return labels;
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.bikeId.set(Number(params.get('id')));
      this.assemblyId.set(Number(params.get('assemblyId')));
      this.garage.set(null);
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
    this.addingPartTo.set(null);
    this.editingSlot.set(null);
    this.editingInterval.set(null);
    this.addingInterval.set(false);
    this.addingItem.set(false);
    this.switching.set(false);
    this.linking.set(false);
    this.settingsOpen.set(false);
    this.reload();
  }

  afterDelete() {
    this.nav.goTo(this.nav.to.bike(this.bikeId()));
  }

  isExpanded(slotId: number): boolean {
    return this.expanded().has(slotId);
  }

  toggleRetired(slotId: number) {
    const next = new Set(this.expanded());
    if (!next.delete(slotId)) next.add(slotId);
    this.expanded.set(next);
  }

  /** Der häufigste Handgriff: ein Tipp, und ab jetzt zählen die km für dieses Teil. */
  mount(part: BikeComponent) {
    this.busy.set(true);
    this.bikeService.mountComponent(part.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.notifications.show(`${part.label} ist drauf. Ab jetzt zählen die km hierfür.`, 'success');
        this.reload();
      },
      error: () => this.busy.set(false),
    });
  }

  markDone(interval: MaintenanceInterval) {
    this.bikeService.logInterval(interval.id).subscribe(() => {
      this.notifications.show(`${interval.label}: erledigt.`, 'success');
      this.justDone.set(interval.id);
      this.reload();
    });
  }

  undoDone(interval: MaintenanceInterval) {
    this.bikeService.undoIntervalLog(interval.id).subscribe(() => {
      this.notifications.show('Zurückgenommen.', 'success');
      this.justDone.set(null);
      this.reload();
    });
  }

  restore() {
    const assembly = this.assembly();
    if (!assembly) return;
    this.bikeService.restoreAssembly(assembly.id).subscribe(() => {
      this.notifications.show(`${assembly.display_name} ist zurück.`, 'success');
      this.reload();
    });
  }

  intervalDetail(interval: MaintenanceInterval): string {
    const parts: string[] = [];
    if (interval.interval_km) {
      parts.push(
        `${Math.round(interval.km_since).toLocaleString('de-DE')} von ${interval.interval_km.toLocaleString('de-DE')} km`,
      );
    }
    if (interval.interval_days && interval.days_since != null) {
      parts.push(`${interval.days_since} von ${interval.interval_days} Tagen`);
    }
    return parts.join(' · ') || 'Ohne Grenze';
  }

  addPartTitle(slot: ComponentSlot): string {
    return `Neu: ${slot.display_name}`;
  }
}
