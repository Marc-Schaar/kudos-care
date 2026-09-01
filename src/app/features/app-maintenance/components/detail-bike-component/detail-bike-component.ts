import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { BikeService } from '../../services/bike-service/bike-service';
import {
  AssembliesResponse,
  BikeAssembly,
  BikeComponent as BikeComponentModel,
  ComponentSlotList,
  ComponentTemplate,
} from '../../models/maintenance.models';
import { WarnLabelPipe } from '../../pipes/warn-label/warn-label-pipe';
import { WarnClassPipe } from '../../pipes/warn-class/warn-class-pipe';
import { AssemblyCardComponent } from '../assembly-card-component/assembly-card-component';
import { SlotCardComponent } from '../slot-card-component/slot-card-component';
import { AddComponentDialogComponent } from '../add-component-dialog-component/add-component-dialog-component';
import { AddAssemblyDialogComponent } from '../add-assembly-dialog-component/add-assembly-dialog-component';
import { ComponentCheckDialogComponent } from '../component-check-dialog-component/component-check-dialog-component';
import { BikeDiagramComponent } from '../bike-diagram-component/bike-diagram-component';
import { EditBikeDialogComponent } from '../edit-bike-dialog-component/edit-bike-dialog-component';
import { ComponentSwapDialogComponent } from '../component-swap-dialog-component/component-swap-dialog-component';
import { QuickChangeDialogComponent } from '../quick-change-dialog-component/quick-change-dialog-component';
import { SwitchAssemblyDialogComponent } from '../switch-assembly-dialog-component/switch-assembly-dialog-component';
import { BikeSetupStepperComponent } from '../bike-setup-stepper-component/bike-setup-stepper-component';
import { Skeleton } from '../../../../shared/components/skeleton/skeleton';
import { NotificationService } from '../../../../shared/services/notification-service/notification-service';

@Component({
  selector: 'app-detail-bike-component',
  imports: [
    RouterLink,
    WarnLabelPipe,
    WarnClassPipe,
    DatePipe,
    DecimalPipe,
    AssemblyCardComponent,
    SlotCardComponent,
    AddComponentDialogComponent,
    AddAssemblyDialogComponent,
    ComponentCheckDialogComponent,
    BikeDiagramComponent,
    EditBikeDialogComponent,
    ComponentSwapDialogComponent,
    QuickChangeDialogComponent,
    SwitchAssemblyDialogComponent,
    BikeSetupStepperComponent,
    Skeleton,
  ],
  templateUrl: './detail-bike-component.html',
  styleUrl: './detail-bike-component.css',
})
export class DetailBikeComponent implements OnInit {
  private route = inject(ActivatedRoute);
  public bikeService = inject(BikeService);
  private notify = inject(NotificationService);

  public bike = this.bikeService.selectedBike;
  public loading = signal(false);
  public assembliesData = signal<AssembliesResponse | null>(null);

  public dialogSlotId = signal<number | null>(null);
  public checkComponentId = signal<number | null>(null);
  public highlightedSlotId = signal<number | null>(null);
  public showEditBikeDialog = signal(false);
  public showAddAssemblyDialog = signal(false);
  public editingComponent = signal<BikeComponentModel | null>(null);
  public swapSlotId = signal<number | null>(null);
  public swapAssembly = signal<BikeAssembly | null>(null);
  public switchAssembly = signal<BikeAssembly | null>(null);
  public retiringAssemblyId = signal<number | null>(null);
  public deletingAssemblyId = signal<number | null>(null);
  /** Zwei-Klick-Bestätigung fürs Löschen einer geparkten Baugruppe (hart, cascadiert). */
  public confirmingDeleteId = signal<number | null>(null);

  public assemblies = computed(() => this.assembliesData()?.assemblies ?? []);
  public parkedAssemblies = computed(() => this.assembliesData()?.parked_assemblies ?? []);
  public ungroupedSlots = computed(() => this.assembliesData()?.ungrouped_slots ?? []);
  public spareComponents = computed(() => this.assembliesData()?.spare_components ?? []);
  public availableGroups = computed(() => this.assembliesData()?.available_groups ?? []);

  public isEmpty = computed(
    () => this.assemblies().length === 0 && this.ungroupedSlots().length === 0,
  );

  public diagramSlots = computed<ComponentSlotList[]>(() => {
    const fromAssemblies = this.assemblies().flatMap((a) => a.slots);
    return [...fromAssemblies, ...this.ungroupedSlots()];
  });

  public criticalCount = computed(
    () => this.bike()?.slots.filter((s) => s.warn_status === 'critical').length ?? 0,
  );
  public warnCount = computed(
    () => this.bike()?.slots.filter((s) => s.warn_status === 'warn').length ?? 0,
  );

  public dialogSlotTemplate = computed<ComponentTemplate | null>(() => {
    const slot = this.bike()?.slots.find((s) => s.id === this.dialogSlotId());
    return slot?.template_detail ?? null;
  });

  public checkComponentTemplate = computed<ComponentTemplate | null>(() => {
    const slot = this.bike()?.slots.find(
      (s) => s.mounted_component?.id === this.checkComponentId(),
    );
    return slot?.template_detail ?? null;
  });

  public checkComponentCurrentConditionPct = computed<number | null>(() => {
    const slot = this.bike()?.slots.find(
      (s) => s.mounted_component?.id === this.checkComponentId(),
    );
    return slot?.mounted_component?.condition_pct ?? null;
  });

  ngOnInit() {
    this.route.params.subscribe((params) => {
      const id = +params['id'];
      this.loading.set(true);
      this.bikeService.fetchBikeDetails(id).subscribe();
      this.bikeService.fetchAssemblies(id).subscribe({
        next: (data) => this.assembliesData.set(data),
        complete: () => this.loading.set(false),
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

  // ── Baugruppe hinzufügen ────────────────────────────────────────────────────
  openAddAssemblyDialog() {
    this.showAddAssemblyDialog.set(true);
  }
  closeAddAssemblyDialog() {
    this.showAddAssemblyDialog.set(false);
  }
  onAssemblyAdded() {
    this.showAddAssemblyDialog.set(false);
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
    const assembly = this.assemblies().find((a) => a.id === assemblyId) ?? null;
    this.swapAssembly.set(assembly);
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
    this.bikeService.activateAssembly(assembly.id).subscribe({
      next: () => this.reload(),
    });
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

  onDiagramDotClick(slotId: number) {
    this.highlightedSlotId.set(slotId);
    setTimeout(() => {
      document.getElementById('slot-' + slotId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });
    setTimeout(() => {
      if (this.highlightedSlotId() === slotId) this.highlightedSlotId.set(null);
    }, 1600);
  }
}
