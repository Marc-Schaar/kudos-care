import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { BikeService } from '../../services/bike-service/bike-service';
import {
  AssembliesResponse,
  BikeAssembly,
  BikeConditionReport,
  ComponentSlotList,
  MaintenanceInterval,
  WarnStatus,
} from '../../models/maintenance.models';
import { BikeDiagramComponent } from '../bike-diagram-component/bike-diagram-component';
import { BikeHeaderComponent } from '../bike-header-component/bike-header-component';
import { Skeleton } from '../../../../shared/components/skeleton/skeleton';
import { WarnClassPipe } from '../../pipes/warn-class/warn-class-pipe';
import { WarnLabelPipe } from '../../pipes/warn-label/warn-label-pipe';

/** Eine Zeile in "Als naechstes faellig" — Teil oder Intervall, vereinheitlicht. */
export interface DueEntry {
  id: string;
  label: string;
  context: string;
  status: WarnStatus;
  /** 0..1+ — verbrauchter Anteil der Lebensdauer. >= 1 heisst ueberfaellig. */
  ratio: number | null;
  detail: string;
}

/**
 * Zustandsseite eines Bikes: nur ansehen, nichts aendern.
 *
 * Bewusst ohne jede Aktion — wer etwas tauschen will, wechselt unten auf
 * "Werkstatt". Das trennt die Frage "wie steht mein Rad da?" von "was mache ich
 * jetzt damit?", statt beides in eine Seite zu mischen.
 */
@Component({
  selector: 'app-bike-condition-page',
  imports: [
    DatePipe,
    DecimalPipe,
    BikeDiagramComponent,
    BikeHeaderComponent,
    Skeleton,
    WarnClassPipe,
    WarnLabelPipe,
  ],
  templateUrl: './bike-condition-page.html',
  styleUrl: './bike-condition-page.css',
})
export class BikeConditionPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly bikeService = inject(BikeService);

  readonly bike = this.bikeService.selectedBike;
  readonly loading = signal(false);
  readonly assembliesData = signal<AssembliesResponse | null>(null);

  readonly showReport = signal(false);
  readonly report = signal<BikeConditionReport | null>(null);
  readonly reportLoading = signal(false);
  readonly reportError = signal<string | null>(null);

  readonly assemblies = computed<BikeAssembly[]>(() => this.assembliesData()?.assemblies ?? []);
  readonly ungroupedSlots = computed<ComponentSlotList[]>(
    () => this.assembliesData()?.ungrouped_slots ?? [],
  );
  readonly parkedCount = computed(() => this.assembliesData()?.parked_assemblies.length ?? 0);

  readonly diagramSlots = computed<ComponentSlotList[]>(() => [
    ...this.assemblies().flatMap((a) => a.slots),
    ...this.ungroupedSlots(),
  ]);

  private readonly allSlots = computed(() => this.diagramSlots());
  private readonly allIntervals = computed<MaintenanceInterval[]>(() =>
    this.assemblies().flatMap((a) => a.intervals),
  );

  readonly criticalCount = computed(
    () =>
      this.allSlots().filter((s) => s.warn_status === 'critical').length +
      this.allIntervals().filter((i) => i.status === 'critical').length,
  );
  readonly warnCount = computed(
    () =>
      this.allSlots().filter((s) => s.warn_status === 'warn').length +
      this.allIntervals().filter((i) => i.status === 'warn').length,
  );
  readonly trackedCount = computed(() => this.allSlots().length + this.allIntervals().length);

  readonly isEmpty = computed(
    () => this.assemblies().length === 0 && this.ungroupedSlots().length === 0,
  );

  /**
   * Alles, was Verschleiss hat, in einer Liste — der dringendste Posten zuerst.
   *
   * Teile und Intervalle werden auf dieselbe Kennzahl gebracht (verbrauchter
   * Anteil der Lebensdauer), damit "als naechstes faellig" wirklich eine
   * Reihenfolge ist und nicht zwei getrennte Listen, die der Nutzer selbst
   * gegeneinander abwaegen muss. Posten ohne Datenbasis (`ratio === null`)
   * landen am Ende statt oben.
   */
  readonly dueList = computed<DueEntry[]>(() => {
    const entries: DueEntry[] = [];

    for (const assembly of this.assemblies()) {
      for (const slot of assembly.slots) {
        entries.push(this.slotEntry(slot, assembly.display_name));
      }
      for (const interval of assembly.intervals) {
        entries.push(this.intervalEntry(interval, assembly.display_name));
      }
    }
    for (const slot of this.ungroupedSlots()) {
      entries.push(this.slotEntry(slot, 'Ohne Baugruppe'));
    }

    return entries.sort((a, b) => (b.ratio ?? -1) - (a.ratio ?? -1));
  });

  /** Nur das, was tatsaechlich Aufmerksamkeit braucht. */
  readonly dueSoon = computed(() =>
    this.dueList().filter((e) => e.status === 'critical' || e.status === 'warn'),
  );

  private slotEntry(slot: ComponentSlotList, context: string): DueEntry {
    const comp = slot.mounted_component;
    const ratios: number[] = [];
    const detail: string[] = [];

    if (comp?.wear_km != null && comp.effective_warn_km) {
      ratios.push(comp.wear_km / comp.effective_warn_km);
      detail.push(`${Math.round(comp.wear_km)} / ${comp.effective_warn_km} km`);
    }
    if (comp?.wear_days != null && comp.effective_warn_days) {
      ratios.push(comp.wear_days / comp.effective_warn_days);
      detail.push(`${comp.wear_days} / ${comp.effective_warn_days} Tage`);
    }

    return {
      id: `slot-${slot.id}`,
      label: slot.display_name,
      context,
      status: slot.warn_status,
      ratio: ratios.length ? Math.max(...ratios) : null,
      detail: comp ? detail.join(' · ') : 'kein Teil montiert',
    };
  }

  private intervalEntry(interval: MaintenanceInterval, context: string): DueEntry {
    const ratios: number[] = [];
    const detail: string[] = [];

    if (interval.km_since != null && interval.interval_km) {
      ratios.push(interval.km_since / interval.interval_km);
      detail.push(`${Math.round(interval.km_since)} / ${interval.interval_km} km`);
    }
    if (interval.days_since != null && interval.interval_days) {
      ratios.push(interval.days_since / interval.interval_days);
      detail.push(`${interval.days_since} / ${interval.interval_days} Tage`);
    }

    return {
      id: `interval-${interval.id}`,
      label: interval.label,
      context,
      status: interval.status,
      ratio: ratios.length ? Math.max(...ratios) : null,
      detail: detail.join(' · ') || 'kein Intervall hinterlegt',
    };
  }

  /** Fuer den Balken: ueber 100 % gestauchte Darstellung, damit nichts ueberlaeuft. */
  barWidth(ratio: number | null): number {
    if (ratio === null) return 0;
    return Math.min(100, Math.round(ratio * 100));
  }

  ngOnInit() {
    this.route.params.subscribe((params) => {
      const id = +params['id'];
      this.loading.set(true);
      this.showReport.set(false);
      this.report.set(null);
      this.reportError.set(null);

      this.bikeService.fetchBikeDetails(id).subscribe();
      this.bikeService.fetchAssemblies(id).subscribe({
        next: (data) => this.assembliesData.set(data),
        complete: () => this.loading.set(false),
        error: () => this.loading.set(false),
      });
    });
  }

  toggleReport() {
    const next = !this.showReport();
    this.showReport.set(next);
    if (next && this.report() === null && !this.reportLoading()) {
      this.loadReport(false);
    }
  }

  reloadReport() {
    this.loadReport(true);
  }

  private loadReport(refresh: boolean) {
    const id = this.bike()?.id;
    if (!id) return;
    this.reportLoading.set(true);
    this.reportError.set(null);
    this.bikeService.fetchConditionReport(id, refresh).subscribe({
      next: (res) => {
        this.reportLoading.set(false);
        this.report.set(res);
      },
      error: (err) => {
        this.reportLoading.set(false);
        this.reportError.set(err?.error?.error ?? 'Zustandsbericht konnte nicht geladen werden.');
      },
    });
  }
}
