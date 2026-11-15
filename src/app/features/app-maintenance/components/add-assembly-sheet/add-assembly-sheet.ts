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
 * Baugruppe ergänzen, z.B. das Cockpit. Laufräder kommen über den eigenen Weg (Laufradsatz).
 * Gibt es den Bereich schon am Rad, entsteht der neue im Keller (der Server parkt ihn) —
 * das sagt das Blatt vorher, statt dass er nach dem Speichern scheinbar verschwindet.
 */
@Component({
  selector: 'app-add-assembly-sheet',
  imports: [AssemblyChecklistComponent, BottomSheet, Icon],
  templateUrl: './add-assembly-sheet.html',
  styles: `
    .lands {
      margin: 0.25rem 0 1rem;
    }
  `,
})
export class AddAssemblySheet {
  bikeId = input.required<number>();
  garage = input.required<AssembliesResponse>();

  closed = output<void>();
  created = output<BikeAssembly>();

  private readonly notifications = inject(NotificationService);

  picked = signal<ComponentGroupCatalog | null>(null);

  groups = computed(() => this.garage().available_groups.filter((group) => group.kind === 'area'));

  /** Der Name der Instanz, die schon am Rad ist, falls es eine gibt. */
  activeFor(group: ComponentGroupCatalog): string | null {
    return (
      this.garage().assemblies.find((assembly) => assembly.group === group.id)?.display_name ?? null
    );
  }

  title = computed(() => this.picked()?.name ?? 'Baugruppe hinzufügen');

  onCreated(assembly: BikeAssembly) {
    const where = assembly.is_parked ? ' Sie liegt im Keller.' : '';
    this.notifications.show(`${assembly.display_name} ist angelegt.${where}`, 'success');
    this.created.emit(assembly);
  }
}
