import { Component, computed, inject, input, output, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BikeAssembly } from '../../models/maintenance.models';
import { WarnClassPipe } from '../../pipes/warn-class/warn-class-pipe';
import { WarnLabelPipe } from '../../pipes/warn-label/warn-label-pipe';
import { SlotCardComponent } from '../slot-card-component/slot-card-component';
import { IntervalRowComponent } from '../interval-row-component/interval-row-component';
import { BikeService } from '../../services/bike-service/bike-service';
import { NotificationService } from '../../../../shared/services/notification-service/notification-service';

/**
 * Karte einer Baugruppe (BikeAssembly). Die Kopfzeile trägt Name, Gesamt-Status,
 * Setup-km und den "Baugruppe tauschen"-Button; darunter die Element-Zeilen
 * (SlotCard) und die Wartungs-Intervalle (IntervalRow).
 */
@Component({
  selector: 'app-assembly-card-component',
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    WarnClassPipe,
    WarnLabelPipe,
    SlotCardComponent,
    IntervalRowComponent,
  ],
  templateUrl: './assembly-card-component.html',
  styleUrl: './assembly-card-component.css',
})
export class AssemblyCardComponent {
  assembly = input.required<BikeAssembly>();
  bikeDistanceKm = input<number | null>(null);
  highlightedSlotId = input<number | null>(null);

  swapAssembly = output<number>();
  editComponent = output<number>();
  swapComponent = output<number>();
  checkComponent = output<number>();
  changed = output<void>();

  private readonly bikeService = inject(BikeService);
  private readonly notify = inject(NotificationService);

  editingName = signal(false);
  nameDraft = signal('');
  savingName = signal(false);

  sortedSlots = computed(() =>
    [...this.assembly().slots].sort((a, b) =>
      a.category.localeCompare(b.category) || a.display_name.localeCompare(b.display_name),
    ),
  );

  startRename() {
    this.nameDraft.set(this.assembly().name || this.assembly().group_detail.name);
    this.editingName.set(true);
  }

  cancelRename() {
    this.editingName.set(false);
  }

  saveRename() {
    const name = this.nameDraft().trim();
    this.savingName.set(true);
    this.bikeService.updateAssembly(this.assembly().id, { name }).subscribe({
      next: () => {
        this.savingName.set(false);
        this.editingName.set(false);
        this.changed.emit();
      },
      error: () => {
        this.savingName.set(false);
        this.notify.show('Umbenennen fehlgeschlagen.', 'error');
      },
    });
  }
}
