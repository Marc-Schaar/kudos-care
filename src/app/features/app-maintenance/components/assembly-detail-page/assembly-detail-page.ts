import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  AssembliesResponse,
  BikeAssembly,
  BikeComponent as BikeComponentModel,
  ComponentSlotList,
  ComponentTemplate,
} from '../../models/maintenance.models';
import { BikeService } from '../../services/bike-service/bike-service';
import { NotificationService } from '../../../../shared/services/notification-service/notification-service';
import { WarnClassPipe } from '../../pipes/warn-class/warn-class-pipe';
import { WarnLabelPipe } from '../../pipes/warn-label/warn-label-pipe';
import { SlotCardComponent } from '../slot-card-component/slot-card-component';
import { IntervalRowComponent } from '../interval-row-component/interval-row-component';
import { AddComponentDialogComponent } from '../add-component-dialog-component/add-component-dialog-component';
import { ComponentCheckDialogComponent } from '../component-check-dialog-component/component-check-dialog-component';
import { ComponentSwapDialogComponent } from '../component-swap-dialog-component/component-swap-dialog-component';
import { QuickChangeDialogComponent } from '../quick-change-dialog-component/quick-change-dialog-component';
import { SwitchAssemblyDialogComponent } from '../switch-assembly-dialog-component/switch-assembly-dialog-component';
import { Skeleton } from '../../../../shared/components/skeleton/skeleton';
import { NavigationService } from '../../../../shared/services/navigation-service/navigation-service';

/**
 * Detailseite einer Baugruppe — loest das Expansion Panel der
 * `assembly-card-component` ab.
 *
 * Das Panel musste Kopfzeile, Statistik, Aktionsreihe, Umbenennen, Loesch-
 * Bestaetigung, alle Teile und alle Intervalle in eine aufklappbare Karte
 * quetschen, von denen mehrere untereinander lagen. Als eigene Seite bekommt
 * jede Baugruppe den ganzen Bildschirm: eine Ueberschrift, eine Aktionsreihe,
 * eine Liste. Die Werkstatt zeigt daneben nur noch kompakte Zeilen.
 *
 * Liegt bewusst unter `bikes/:id/werkstatt/:assemblyId`, damit der Tab
 * "Werkstatt" in der unteren Navigation aktiv bleibt (`routerLinkActive` ohne
 * `exact`).
 */
@Component({
  selector: 'app-assembly-detail-page',
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    RouterLink,
    WarnClassPipe,
    WarnLabelPipe,
    SlotCardComponent,
    IntervalRowComponent,
    AddComponentDialogComponent,
    ComponentCheckDialogComponent,
    ComponentSwapDialogComponent,
    QuickChangeDialogComponent,
    SwitchAssemblyDialogComponent,
    Skeleton,
  ],
  templateUrl: './assembly-detail-page.html',
  styleUrl: './assembly-detail-page.css',
})
export class AssemblyDetailPage implements OnInit {
  readonly nav = inject(NavigationService);
  private readonly route = inject(ActivatedRoute);
  private readonly notify = inject(NotificationService);
  readonly bikeService = inject(BikeService);

  readonly bikeId = signal<number | null>(null);
  readonly assemblyId = signal<number | null>(null);
  readonly loading = signal(false);
  readonly data = signal<AssembliesResponse | null>(null);

  readonly editingName = signal(false);
  readonly nameDraft = signal('');
  readonly savingName = signal(false);
  readonly confirmingDelete = signal(false);
  readonly deleting = signal(false);

  readonly showSwitch = signal(false);
  readonly showRenew = signal(false);
  readonly dialogSlotId = signal<number | null>(null);
  readonly editingComponent = signal<BikeComponentModel | null>(null);
  readonly swapSlotId = signal<number | null>(null);
  readonly checkComponentId = signal<number | null>(null);

  /**
   * Die Baugruppe wird aus der Liste des Bikes gesucht statt einzeln geladen —
   * `GET assemblies/` liefert nebenbei die geparkten Alternativen, die der
   * Wechsel-Dialog braucht, und die Werkstatt hat die Antwort ohnehin schon.
   */
  readonly assembly = computed<BikeAssembly | null>(() => {
    const id = this.assemblyId();
    const all = this.data();
    if (id === null || all === null) return null;
    return [...all.assemblies, ...all.parked_assemblies].find((a) => a.id === id) ?? null;
  });

  readonly parkedAssemblies = computed(() => this.data()?.parked_assemblies ?? []);
  readonly bikeDistanceKm = computed(
    () => this.bikeService.selectedBike()?.total_distance_km ?? null,
  );

  /** Nicht gefunden heisst hier: geladen, aber die Id kommt in der Antwort nicht vor. */
  readonly notFound = computed(
    () => !this.loading() && this.data() !== null && this.assembly() === null,
  );

  readonly sortedSlots = computed<ComponentSlotList[]>(() =>
    [...(this.assembly()?.slots ?? [])].sort((a, b) =>
      a.display_name.localeCompare(b.display_name, 'de'),
    ),
  );

  /** Nur echte Baugruppen lassen sich am Stück erneuern (siehe Backend GroupKind). */
  readonly isSwappableAssembly = computed(() => this.assembly()?.group_detail.kind === 'assembly');

  readonly alternativeCount = computed(() => {
    const current = this.assembly();
    if (!current) return 0;
    return this.parkedAssemblies().filter((a) => a.group === current.group).length;
  });

  readonly dialogSlotTemplate = computed<ComponentTemplate | null>(
    () => this.sortedSlots().find((s) => s.id === this.dialogSlotId())?.template_detail ?? null,
  );
  readonly checkComponentTemplate = computed<ComponentTemplate | null>(
    () =>
      this.sortedSlots().find((s) => s.mounted_component?.id === this.checkComponentId())
        ?.template_detail ?? null,
  );
  readonly checkComponentConditionPct = computed<number | null>(
    () =>
      this.sortedSlots().find((s) => s.mounted_component?.id === this.checkComponentId())
        ?.mounted_component?.condition_pct ?? null,
  );

  // ── Element nachtragen ──────────────────────────────────────────────────────
  readonly addingItem = signal(false);
  readonly savingItem = signal(false);
  readonly itemError = signal<string | null>(null);
  newItemTemplateId: number | null = null;
  newItemBrand = '';
  newItemInstalledAt = new Date().toISOString().split('T')[0];

  /**
   * Katalog-Elemente der Gruppe, die in dieser Instanz noch fehlen.
   *
   * Ohne diese Liste liess sich eine vergessene Kassette nur nachtragen, indem
   * man die ganze Baugruppe neu anlegte — der Assistent greift nur beim Anlegen.
   */
  readonly addableItems = computed(() => {
    const asm = this.assembly();
    if (!asm) return [];
    const present = new Set([
      ...asm.slots.map((s) => s.template),
      ...asm.intervals.map((i) => i.template).filter((t): t is number => t != null),
    ]);
    return [...asm.group_detail.parts, ...asm.group_detail.consumables].filter(
      (t) => !present.has(t.id),
    );
  });

  startAddItem() {
    this.itemError.set(null);
    this.newItemTemplateId = this.addableItems()[0]?.id ?? null;
    this.newItemBrand = '';
    this.newItemInstalledAt =
      this.assembly()?.installed_at ?? new Date().toISOString().split('T')[0];
    this.addingItem.set(true);
  }

  cancelAddItem() {
    this.addingItem.set(false);
  }

  saveItem() {
    const asm = this.assembly();
    if (!asm || this.newItemTemplateId == null) return;
    this.savingItem.set(true);
    this.itemError.set(null);
    this.bikeService
      .addAssemblyItem(asm.id, {
        template_id: this.newItemTemplateId,
        brand: this.newItemBrand.trim(),
        installed_at: this.newItemInstalledAt || null,
      })
      .subscribe({
        next: () => {
          this.savingItem.set(false);
          this.addingItem.set(false);
          this.reload();
        },
        error: (err) => {
          this.savingItem.set(false);
          this.itemError.set(err?.error?.error ?? 'Hinzufügen fehlgeschlagen.');
        },
      });
  }

  // ── Einbaudatum für alle Teile dieser Baugruppe ─────────────────────────────
  readonly settingDate = signal(false);
  readonly savingDate = signal(false);
  bulkInstalledAt = new Date().toISOString().split('T')[0];

  startBulkDate() {
    this.bulkInstalledAt = this.assembly()?.installed_at ?? new Date().toISOString().split('T')[0];
    this.settingDate.set(true);
  }

  cancelBulkDate() {
    this.settingDate.set(false);
  }

  saveBulkDate() {
    const asm = this.assembly();
    const bikeId = this.bikeId();
    if (!asm || bikeId === null) return;
    this.savingDate.set(true);
    this.bikeService.setInstalledAtForAll(bikeId, this.bulkInstalledAt, asm.id).subscribe({
      next: (res) => {
        this.savingDate.set(false);
        this.settingDate.set(false);
        this.notify.show(`Einbaudatum für ${res.components_updated} Teile gesetzt.`, 'success');
        this.reload();
      },
      error: (err) => {
        this.savingDate.set(false);
        this.notify.show(err?.error?.error ?? 'Setzen fehlgeschlagen.', 'error');
      },
    });
  }

  ngOnInit() {
    this.route.params.subscribe((params) => {
      const bikeId = +params['id'];
      this.bikeId.set(bikeId);
      this.assemblyId.set(+params['assemblyId']);
      this.loading.set(true);
      this.bikeService.fetchBikeDetails(bikeId).subscribe();
      this.bikeService.fetchAssemblies(bikeId).subscribe({
        next: (res) => this.data.set(res),
        complete: () => this.loading.set(false),
        error: () => this.loading.set(false),
      });
    });
  }

  private reload() {
    const id = this.bikeId();
    if (id === null) return;
    this.bikeService.fetchBikeDetails(id).subscribe();
    this.bikeService.fetchAssemblies(id).subscribe({ next: (res) => this.data.set(res) });
  }

  private backToWorkshop() {
    this.nav.goTo(this.nav.to.workshop(this.bikeId()!));
  }

  // ── Umbenennen ──────────────────────────────────────────────────────────────
  startRename() {
    const current = this.assembly();
    if (!current) return;
    this.nameDraft.set(current.name || current.display_name);
    this.editingName.set(true);
  }
  cancelRename() {
    this.editingName.set(false);
  }
  saveRename() {
    const current = this.assembly();
    const name = this.nameDraft().trim();
    if (!current || !name) {
      this.editingName.set(false);
      return;
    }
    this.savingName.set(true);
    this.bikeService.updateAssembly(current.id, { name }).subscribe({
      next: () => {
        this.savingName.set(false);
        this.editingName.set(false);
        this.reload();
      },
      error: () => {
        this.savingName.set(false);
        this.notify.show('Umbenennen fehlgeschlagen.', 'error');
      },
    });
  }

  // ── Gruppierung auflösen ────────────────────────────────────────────────────
  requestDelete() {
    this.confirmingDelete.set(true);
  }
  cancelDelete() {
    this.confirmingDelete.set(false);
  }
  confirmDeleteNow() {
    const current = this.assembly();
    if (!current) return;
    this.deleting.set(true);
    this.bikeService.deleteAssembly(current.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.notify.show(
          `„${current.display_name}“ aufgelöst — die Teile bleiben am Rad.`,
          'success',
        );
        this.backToWorkshop();
      },
      error: (err) => {
        this.deleting.set(false);
        this.confirmingDelete.set(false);
        this.notify.show(err?.error?.error ?? 'Auflösen fehlgeschlagen.', 'error');
      },
    });
  }

  // ── Wechseln / Teile erneuern ───────────────────────────────────────────────
  openSwitch() {
    this.showSwitch.set(true);
  }
  closeSwitch() {
    this.showSwitch.set(false);
  }
  onSwitched() {
    this.showSwitch.set(false);
    // Nach dem Wechsel ist diese Instanz geparkt und eine andere aktiv — die
    // Werkstatt ist der richtige Ort, um weiterzumachen.
    this.backToWorkshop();
  }

  openRenew() {
    this.showRenew.set(true);
  }
  closeRenew() {
    this.showRenew.set(false);
  }
  onRenewed() {
    this.showRenew.set(false);
    // "Teile erneuern" mustert diese Instanz aus und legt eine neue an — die
    // aufgerufene Id existiert danach nur noch als Historie.
    this.backToWorkshop();
  }

  // ── Einzelteile ─────────────────────────────────────────────────────────────
  openEditComponent(componentId: number) {
    this.bikeService.fetchComponent(componentId).subscribe({
      next: (comp) => {
        this.editingComponent.set(comp);
        this.dialogSlotId.set(comp.slot);
      },
    });
  }
  closeComponentDialog() {
    this.dialogSlotId.set(null);
    this.editingComponent.set(null);
  }
  onComponentSaved() {
    this.closeComponentDialog();
    this.reload();
  }

  openSwapComponent(slotId: number) {
    this.swapSlotId.set(slotId);
  }
  closeSwapComponent() {
    this.swapSlotId.set(null);
  }
  onComponentMounted() {
    this.swapSlotId.set(null);
    this.reload();
  }
  onCreateNewFromSwap(slotId: number) {
    this.swapSlotId.set(null);
    this.editingComponent.set(null);
    this.dialogSlotId.set(slotId);
  }

  openCheck(componentId: number) {
    this.checkComponentId.set(componentId);
  }
  closeCheck() {
    this.checkComponentId.set(null);
  }
  onCheckSaved() {
    this.checkComponentId.set(null);
    this.reload();
  }

  onIntervalLogged() {
    this.reload();
  }
}
