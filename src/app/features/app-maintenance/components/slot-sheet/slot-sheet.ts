import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { NotificationService } from '../../../../shared/services/notification-service/notification-service';
import { ComponentSlot } from '../../models/maintenance.models';
import { BikeService } from '../../services/bike-service/bike-service';
import { BottomSheet } from '../bottom-sheet/bottom-sheet';

/** Einen Platz umbenennen oder entfernen, z.B. weil das Rad gar keine Schläuche hat. */
@Component({
  selector: 'app-slot-sheet',
  imports: [BottomSheet, FormsModule],
  templateUrl: './slot-sheet.html',
})
export class SlotSheet implements OnInit {
  slot = input.required<ComponentSlot>();

  closed = output<void>();
  changed = output<void>();
  /** Ein weiteres Teil für diesen Platz, zum Beispiel zweite Bremsbeläge fürs Regal. */
  addPart = output<void>();

  private readonly bikeService = inject(BikeService);
  private readonly notifications = inject(NotificationService);

  name = signal('');
  busy = signal(false);
  confirmingDelete = signal(false);

  partCount = computed(() => {
    const slot = this.slot();
    return (
      (slot.mounted_component ? 1 : 0) +
      slot.spare_components.length +
      slot.retired_components.length
    );
  });

  ngOnInit() {
    this.name.set(this.slot().custom_name);
  }

  private act(request: Observable<unknown>, message: string) {
    this.busy.set(true);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.notifications.show(message, 'success');
        this.changed.emit();
      },
      error: () => this.busy.set(false),
    });
  }

  rename() {
    this.act(this.bikeService.renameSlot(this.slot().id, this.name().trim()), 'Gespeichert.');
  }

  delete() {
    this.act(this.bikeService.deleteSlot(this.slot().id), 'Platz entfernt.');
  }
}
