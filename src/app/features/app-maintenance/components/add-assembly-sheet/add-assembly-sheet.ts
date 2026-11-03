import { Component, computed, inject, input, output, signal } from '@angular/core';
import { NotificationService } from '../../../../shared/services/notification-service/notification-service';
import {
  AssembliesResponse,
  BikeAssembly,
  ComponentGroupCatalog,
} from '../../models/maintenance.models';
import { AssemblyChecklistComponent } from '../assembly-checklist-component/assembly-checklist-component';
import { Icon } from '../../../../shared/components/icon/icon';
import { BottomSheet } from '../bottom-sheet/bottom-sheet';

/**
 * Baugruppe ergänzen, z.B. das Cockpit. Laufräder kommen über den eigenen Weg (Laufradsatz);
 * hier stehen nur die Bereiche, die es an diesem Rad noch nicht gibt.
 */
@Component({
  selector: 'app-add-assembly-sheet',
  imports: [AssemblyChecklistComponent, BottomSheet, Icon],
  templateUrl: './add-assembly-sheet.html',
})
export class AddAssemblySheet {
  bikeId = input.required<number>();
  garage = input.required<AssembliesResponse>();

  closed = output<void>();
  created = output<BikeAssembly>();

  private readonly notifications = inject(NotificationService);

  picked = signal<ComponentGroupCatalog | null>(null);

  groups = computed(() =>
    this.garage().available_groups.filter((group) => group.kind === 'area'),
  );

  title = computed(() => this.picked()?.name ?? 'Baugruppe hinzufügen');

  onCreated(assembly: BikeAssembly) {
    this.notifications.show(`${assembly.display_name} ist angelegt.`, 'success');
    this.created.emit(assembly);
  }
}
