import { Component, computed, inject, numberAttribute, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BikeService } from '../../services/bike-service/bike-service';
import { SlotGroup } from '../../models/maintenance.models';
import { groupSlotsByCategory } from '../../shared/utils/utils';
import { WarnLabelPipe } from '../../pipes/warn-label/warn-label-pipe';
import { WarnClassPipe } from '../../pipes/warn-class/warn-class-pipe';
import { DecimalPipe } from '@angular/common';
import { SlotCardComponent } from '../slot-card-component/slot-card-component';
import { AddComponentDialogComponent } from '../add-component-dialog-component/add-component-dialog-component';
import { AddSlotDialogComponent } from '../add-slot-dialog-component/add-slot-dialog-component';

@Component({
  selector: 'app-detail-bike-component',
  imports: [
    WarnLabelPipe,
    WarnClassPipe,
    DecimalPipe,
    SlotCardComponent,
    AddComponentDialogComponent,
    AddSlotDialogComponent,
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
    this.dialogSlotId.set(slotId);
  }

  closeDialog() {
    this.dialogSlotId.set(null);
  }

  onComponentSaved() {
    this.dialogSlotId.set(null);
    // Bike neu laden damit Warn-Status aktuell ist
    const id = this.bike()?.id;
    if (id) this.bikeService.fetchBikeDetails(id).subscribe();
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
}
