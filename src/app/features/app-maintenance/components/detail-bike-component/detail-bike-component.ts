import { Component, computed, inject, numberAttribute, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BikeService } from '../../services/bike-service/bike-service';
import {
  BikeComponent as BikeComponentModel,
  ComponentTemplate,
  SlotGroup,
} from '../../models/maintenance.models';
import { groupSlotsByCategory } from '../../shared/utils/utils';
import { WarnLabelPipe } from '../../pipes/warn-label/warn-label-pipe';
import { WarnClassPipe } from '../../pipes/warn-class/warn-class-pipe';
import { DecimalPipe } from '@angular/common';
import { SlotCardComponent } from '../slot-card-component/slot-card-component';
import { AddComponentDialogComponent } from '../add-component-dialog-component/add-component-dialog-component';
import { AddSlotDialogComponent } from '../add-slot-dialog-component/add-slot-dialog-component';
import { ComponentCheckDialogComponent } from '../component-check-dialog-component/component-check-dialog-component';
import { BikeDiagramComponent } from '../bike-diagram-component/bike-diagram-component';
import { EditBikeDialogComponent } from '../edit-bike-dialog-component/edit-bike-dialog-component';
import { ComponentSwapDialogComponent } from '../component-swap-dialog-component/component-swap-dialog-component';
import { Skeleton } from '../../../../shared/components/skeleton/skeleton';

@Component({
  selector: 'app-detail-bike-component',
  imports: [
    WarnLabelPipe,
    WarnClassPipe,
    DecimalPipe,
    SlotCardComponent,
    AddComponentDialogComponent,
    AddSlotDialogComponent,
    ComponentCheckDialogComponent,
    BikeDiagramComponent,
    EditBikeDialogComponent,
    ComponentSwapDialogComponent,
    Skeleton,
  ],
  templateUrl: './detail-bike-component.html',
  styleUrl: './detail-bike-component.css',
})
export class DetailBikeComponent implements OnInit {
  private route = inject(ActivatedRoute);
  public bikeService = inject(BikeService);

  public bike = this.bikeService.selectedBike;
  public loading = signal(false);
  public dialogSlotId = signal<number | null>(null);
  public showAddSlotDialog = signal(false);
  public checkComponentId = signal<number | null>(null);
  public highlightedSlotId = signal<number | null>(null);
  public showEditBikeDialog = signal(false);
  public editingComponent = signal<BikeComponentModel | null>(null);
  public swapSlotId = signal<number | null>(null);

  public slotGroups = computed<SlotGroup[]>(() => {
    const b = this.bike();
    if (!b) return [];
    return groupSlotsByCategory(b.slots);
  });

  public criticalCount = computed(
    () => this.bike()?.slots.filter((s) => s.warn_status === 'critical').length ?? 0,
  );

  public warnCount = computed(
    () => this.bike()?.slots.filter((s) => s.warn_status === 'warn').length ?? 0,
  );

  public existingTemplateIds = computed(() => this.bike()?.slots.map((s) => s.template) ?? []);

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
      this.bikeService.fetchBikeDetails(id).subscribe({
        complete: () => this.loading.set(false),
      });
    });
  }

  openAddDialog(slotId: number) {
    this.editingComponent.set(null);
    this.dialogSlotId.set(slotId);
  }

  openEditComponentDialog(componentId: number) {
    this.bikeService.fetchComponent(componentId).subscribe({
      next: (comp) => {
        this.editingComponent.set(comp);
        this.dialogSlotId.set(comp.slot);
      },
    });
  }

  onDiagramDotClick(slotId: number) {
    this.highlightedSlotId.set(slotId);
    // Nächster Tick, damit das Ziel-Element sicher gerendert ist.
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

  closeDialog() {
    this.dialogSlotId.set(null);
    this.editingComponent.set(null);
  }

  onComponentSaved() {
    this.dialogSlotId.set(null);
    this.editingComponent.set(null);
    // Bike neu laden damit Warn-Status aktuell ist
    const id = this.bike()?.id;
    if (id) this.bikeService.fetchBikeDetails(id).subscribe();
  }

  openSwapDialog(slotId: number) {
    this.swapSlotId.set(slotId);
  }

  closeSwapDialog() {
    this.swapSlotId.set(null);
  }

  onSwapMounted() {
    this.swapSlotId.set(null);
    const id = this.bike()?.id;
    if (id) this.bikeService.fetchBikeDetails(id).subscribe();
  }

  onCreateNewFromSwap(slotId: number) {
    this.swapSlotId.set(null);
    this.openAddDialog(slotId);
  }

  openAddSlotDialog() {
    this.showAddSlotDialog.set(true);
  }

  closeAddSlotDialog() {
    this.showAddSlotDialog.set(false);
  }

  onSlotCreated(newSlotId: number) {
    this.showAddSlotDialog.set(false);
    const id = this.bike()?.id;
    if (!id) return;
    this.bikeService.fetchBikeDetails(id).subscribe({
      complete: () => this.dialogSlotId.set(newSlotId),
    });
  }

  openEditBikeDialog() {
    this.showEditBikeDialog.set(true);
  }

  closeEditBikeDialog() {
    this.showEditBikeDialog.set(false);
  }

  onBikeSaved() {
    this.showEditBikeDialog.set(false);
  }

  openCheckDialog(componentId: number) {
    this.checkComponentId.set(componentId);
  }

  closeCheckDialog() {
    this.checkComponentId.set(null);
  }

  onCheckSaved() {
    this.checkComponentId.set(null);
    const id = this.bike()?.id;
    if (id) this.bikeService.fetchBikeDetails(id).subscribe();
  }
}
