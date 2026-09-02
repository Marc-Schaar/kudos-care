import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { BikeService } from '../../services/bike-service/bike-service';
import {
  AssembliesResponse,
  BikeAssembly,
  BikeComponent as BikeComponentModel,
  ComponentSlotList,
  ComponentTemplate,
} from '../../models/maintenance.models';
import { NotificationService } from '../../../../shared/services/notification-service/notification-service';
import { AssemblyCardComponent } from '../assembly-card-component/assembly-card-component';
import { SlotCardComponent } from '../slot-card-component/slot-card-component';
import { BikeHeaderComponent } from '../bike-header-component/bike-header-component';
import { AssemblyWizardComponent } from '../assembly-wizard-component/assembly-wizard-component';
import { AddComponentDialogComponent } from '../add-component-dialog-component/add-component-dialog-component';
import { ComponentCheckDialogComponent } from '../component-check-dialog-component/component-check-dialog-component';
import { ComponentSwapDialogComponent } from '../component-swap-dialog-component/component-swap-dialog-component';
import { EditBikeDialogComponent } from '../edit-bike-dialog-component/edit-bike-dialog-component';
import { QuickChangeDialogComponent } from '../quick-change-dialog-component/quick-change-dialog-component';
import { SwitchAssemblyDialogComponent } from '../switch-assembly-dialog-component/switch-assembly-dialog-component';
import { BikeSetupStepperComponent } from '../bike-setup-stepper-component/bike-setup-stepper-component';
import { Skeleton } from '../../../../shared/components/skeleton/skeleton';

/**
 * Werkstatt-Seite: alles, was etwas veraendert.
 *
 * Die Gegenseite zur Zustandsseite — dort wird nur gelesen, hier nur gehandelt.
 * Uebernimmt die Aktionslogik der frueheren `detail-bike-component`, die beides
 * in einer 1.100-Zeilen-Seite vermischt hatte.
 */
@Component({
  selector: 'app-bike-service-page',
  imports: [
    DatePipe,
    DecimalPipe,
    AssemblyCardComponent,
    SlotCardComponent,
    BikeHeaderComponent,
    AssemblyWizardComponent,
    AddComponentDialogComponent,
    ComponentCheckDialogComponent,
    ComponentSwapDialogComponent,
    EditBikeDialogComponent,
    QuickChangeDialogComponent,
    SwitchAssemblyDialogComponent,
    BikeSetupStepperComponent,
    Skeleton,
  ],
  templateUrl: './bike-service-page.html',
  styleUrl: './bike-service-page.css',
})
export class BikeServicePage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly notify = inject(NotificationService);
  readonly bikeService = inject(BikeService);

  readonly bike = this.bikeService.selectedBike;
  readonly loading = signal(false);
  readonly assembliesData = signal<AssembliesResponse | null>(null);

  readonly dialogSlotId = signal<number | null>(null);
  readonly checkComponentId = signal<number | null>(null);
  readonly highlightedSlotId = signal<number | null>(null);
  readonly showEditBikeDialog = signal(false);
  readonly showAssemblyWizard = signal(false);
  readonly editingComponent = signal<BikeComponentModel | null>(null);
  readonly swapSlotId = signal<number | null>(null);
  readonly swapAssembly = signal<BikeAssembly | null>(null);
  readonly switchAssembly = signal<BikeAssembly | null>(null);
  readonly retiringAssemblyId = signal<number | null>(null);
  readonly deletingAssemblyId = signal<number | null>(null);
  /** Zwei-Klick-Bestätigung fürs Löschen einer geparkten Baugruppe (hart, cascadiert). */
  readonly confirmingDeleteId = signal<number | null>(null);

  readonly assemblies = computed(() => this.assembliesData()?.assemblies ?? []);
  readonly parkedAssemblies = computed(() => this.assembliesData()?.parked_assemblies ?? []);
  readonly ungroupedSlots = computed(() => this.assembliesData()?.ungrouped_slots ?? []);
  readonly spareComponents = computed(() => this.assembliesData()?.spare_components ?? []);
  readonly availableGroups = computed(() => this.assembliesData()?.available_groups ?? []);

  readonly isEmpty = computed(
    () => this.assemblies().length === 0 && this.ungroupedSlots().length === 0,
  );

  readonly dialogSlotTemplate = computed<ComponentTemplate | null>(() => {
    const slot = this.allSlots().find((s) => s.id === this.dialogSlotId());
    return slot?.template_detail ?? null;
  });

  readonly checkComponentTemplate = computed<ComponentTemplate | null>(() => {
    const slot = this.allSlots().find((s) => s.mounted_component?.id === this.checkComponentId());
    return slot?.template_detail ?? null;
  });

  readonly checkComponentCurrentConditionPct = computed<number | null>(() => {
    const slot = this.allSlots().find((s) => s.mounted_component?.id === this.checkComponentId());
    return slot?.mounted_component?.condition_pct ?? null;
  });

  private allSlots = computed<ComponentSlotList[]>(() => [
    ...this.assemblies().flatMap((a) => a.slots),
    ...this.ungroupedSlots(),
  ]);

  ngOnInit() {
    this.route.params.subscribe((params) => {
      const id = +params['id'];
      this.loading.set(true);
      this.bikeService.fetchBikeDetails(id).subscribe();
      this.bikeService.fetchAssemblies(id).subscribe({
        next: (data) => this.assembliesData.set(data),
        complete: () => this.loading.set(false),
        error: () => this.loading.set(false),
      });
    });
  }

  private reload() {
    const id = this.bike()?.id;
    if (!id) return;
    this.bikeService.fetchBikeDetails(id).subscribe();
    this.bikeService.fetchAssemblies(id).subscribe({
      next: (data) => this.assembliesData.set(data),
    });
  }

  // ── Baugruppe anlegen ───────────────────────────────────────────────────────
  openAssemblyWizard() {
    this.showAssemblyWizard.set(true);
  }
  closeAssemblyWizard() {
    this.showAssemblyWizard.set(false);
  }
  onAssemblyCreated() {
    this.showAssemblyWizard.set(false);
    this.reload();
  }

  // ── Baugruppe wechseln (anderer Satz) ───────────────────────────────────────
  openSwitchAssembly(assemblyId: number) {
    this.switchAssembly.set(this.assemblies().find((a) => a.id === assemblyId) ?? null);
  }
  closeSwitchAssembly() {
    this.switchAssembly.set(null);
  }
  onAssemblySwitched() {
    this.switchAssembly.set(null);
    this.reload();
  }

  // ── Teile dieser Baugruppe erneuern ─────────────────────────────────────────
  openSwapAssembly(assemblyId: number) {
    this.swapAssembly.set(this.assemblies().find((a) => a.id === assemblyId) ?? null);
  }
  closeSwapAssembly() {
    this.swapAssembly.set(null);
  }
  onAssemblySwapped() {
    this.swapAssembly.set(null);
    this.reload();
  }

  // ── Geparkte Baugruppen ─────────────────────────────────────────────────────
  activateParked(assembly: BikeAssembly) {
    this.bikeService.activateAssembly(assembly.id).subscribe({ next: () => this.reload() });
  }

  retireParked(assembly: BikeAssembly) {
    this.retiringAssemblyId.set(assembly.id);
    this.bikeService.retireAssembly(assembly.id).subscribe({
      next: () => {
        this.retiringAssemblyId.set(null);
        this.reload();
      },
      error: () => this.retiringAssemblyId.set(null),
    });
  }

  requestDeleteParked(assembly: BikeAssembly) {
    this.confirmingDeleteId.set(assembly.id);
  }
  cancelDeleteParked() {
    this.confirmingDeleteId.set(null);
  }
  confirmDeleteParked(assembly: BikeAssembly) {
    this.deletingAssemblyId.set(assembly.id);
    this.bikeService.deleteAssembly(assembly.id).subscribe({
      next: () => {
        this.deletingAssemblyId.set(null);
        this.confirmingDeleteId.set(null);
        this.notify.show(`Baugruppe "${assembly.display_name}" gelöscht.`, 'success');
        this.reload();
      },
      error: () => {
        this.deletingAssemblyId.set(null);
        this.notify.show('Löschen fehlgeschlagen.', 'error');
      },
    });
  }

  onStepperDone() {
    this.reload();
  }
  onAssemblyChanged() {
    this.reload();
  }

  // ── Einzelteil bearbeiten / tauschen / prüfen ───────────────────────────────
  openEditComponentDialog(componentId: number) {
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
    this.dialogSlotId.set(null);
    this.editingComponent.set(null);
    this.reload();
  }

  openSwapDialog(slotId: number) {
    this.swapSlotId.set(slotId);
  }
  closeSwapDialog() {
    this.swapSlotId.set(null);
  }
  onSwapMounted() {
    this.swapSlotId.set(null);
    this.reload();
  }
  onCreateNewFromSwap(slotId: number) {
    this.swapSlotId.set(null);
    this.editingComponent.set(null);
    this.dialogSlotId.set(slotId);
  }

  openCheckDialog(componentId: number) {
    this.checkComponentId.set(componentId);
  }
  closeCheckDialog() {
    this.checkComponentId.set(null);
  }
  onCheckSaved() {
    this.checkComponentId.set(null);
    this.reload();
  }

  // ── Bike bearbeiten ─────────────────────────────────────────────────────────
  openEditBikeDialog() {
    this.showEditBikeDialog.set(true);
  }
  closeEditBikeDialog() {
    this.showEditBikeDialog.set(false);
  }
  onBikeSaved() {
    this.showEditBikeDialog.set(false);
  }
}
