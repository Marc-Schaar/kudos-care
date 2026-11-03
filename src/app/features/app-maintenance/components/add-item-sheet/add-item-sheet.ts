import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { switchMap } from 'rxjs';
import { NotificationService } from '../../../../shared/services/notification-service/notification-service';
import {
  BikeAssembly,
  ComponentTemplate,
  MaintenanceKind,
} from '../../models/maintenance.models';
import { BikeService } from '../../services/bike-service/bike-service';
import { BottomSheet } from '../bottom-sheet/bottom-sheet';

/**
 * Was dieser Baugruppe noch fehlt: ein Tipp legt den Platz an. Steht etwas nicht im Katalog,
 * entsteht daraus eine eigene Vorlage, die nur dieser Nutzer sieht.
 */
@Component({
  selector: 'app-add-item-sheet',
  imports: [BottomSheet, FormsModule],
  templateUrl: './add-item-sheet.html',
})
export class AddItemSheet {
  assembly = input.required<BikeAssembly>();

  closed = output<void>();
  added = output<void>();

  private readonly bikeService = inject(BikeService);
  private readonly notifications = inject(NotificationService);

  busy = signal(false);
  custom = signal(false);
  name = signal('');
  kind = signal<MaintenanceKind>('part');
  warnKm = signal<number | null>(null);
  warnDays = signal<number | null>(null);

  missingParts = computed(() => {
    const present = new Set(this.assembly().slots.map((slot) => slot.template));
    return this.assembly().group_detail.parts.filter((template) => !present.has(template.id));
  });

  missingConsumables = computed(() => {
    const present = new Set(this.assembly().intervals.map((interval) => interval.template));
    return this.assembly().group_detail.consumables.filter(
      (template) => !present.has(template.id),
    );
  });

  add(template: ComponentTemplate) {
    this.busy.set(true);
    this.bikeService.addAssemblyItem(this.assembly().id, { template_id: template.id }).subscribe({
      next: () => this.finish(template.name),
      error: () => this.busy.set(false),
    });
  }

  addCustom() {
    const name = this.name().trim();
    if (!name) return;
    this.busy.set(true);
    const group = this.assembly().group_detail;
    this.bikeService
      .createTemplate({
        name,
        category: group.category,
        group: group.id,
        maintenance_kind: this.kind(),
        applicable_bike_types: [],
        warn_km: this.warnKm(),
        warn_days: this.warnDays(),
      })
      .pipe(
        switchMap((template) =>
          this.bikeService.addAssemblyItem(this.assembly().id, { template_id: template.id }),
        ),
      )
      .subscribe({
        next: () => this.finish(name),
        error: () => this.busy.set(false),
      });
  }

  private finish(name: string) {
    this.busy.set(false);
    this.notifications.show(`${name} ist dabei.`, 'success');
    this.added.emit();
  }
}
