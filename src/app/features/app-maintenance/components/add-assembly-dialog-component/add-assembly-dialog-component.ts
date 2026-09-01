import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { BikeType, ComponentGroupCatalog, ComponentSlotList } from '../../models/maintenance.models';
import { BikeService } from '../../services/bike-service/bike-service';
import { AssemblyChecklistComponent } from '../assembly-checklist-component/assembly-checklist-component';
import { NotificationService } from '../../../../shared/services/notification-service/notification-service';

/**
 * Dialog "Baugruppe hinzufügen": Schritt 1 wählt eine Baugruppe aus dem Katalog
 * (bike-typ-gefiltert, bereits aktive ausgeblendet — vom Aufrufer via
 * `availableGroups` geliefert), Schritt 2 ist die Element-Checkliste.
 */
@Component({
  selector: 'app-add-assembly-dialog-component',
  imports: [AssemblyChecklistComponent],
  templateUrl: './add-assembly-dialog-component.html',
  styleUrl: './add-assembly-dialog-component.css',
})
export class AddAssemblyDialogComponent implements OnInit {
  bikeId = input.required<number>();
  bikeType = input.required<BikeType>();
  availableGroups = input<ComponentGroupCatalog[] | null>(null);
  /** Ungruppierte Slots des Bikes — für den "vorhandene Komponente übernehmen"-Vorschlag. */
  ungroupedSlots = input<ComponentSlotList[]>([]);

  close = output<void>();
  saved = output<void>();

  private readonly bikeService = inject(BikeService);
  private readonly notify = inject(NotificationService);

  loading = signal(false);
  groups = signal<ComponentGroupCatalog[]>([]);
  selectedGroup = signal<ComponentGroupCatalog | null>(null);

  ngOnInit() {
    const provided = this.availableGroups();
    if (provided) {
      this.groups.set(provided);
      return;
    }
    this.loading.set(true);
    this.bikeService.fetchGroups(this.bikeType()).subscribe({
      next: (groups) => {
        this.groups.set(groups);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  pickGroup(group: ComponentGroupCatalog) {
    this.selectedGroup.set(group);
  }

  back() {
    this.selectedGroup.set(null);
  }

  onCreated() {
    this.notify.show(`Baugruppe "${this.selectedGroup()?.name}" angelegt.`, 'success');
    this.saved.emit();
  }

  onOverlayClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('overlay')) {
      this.close.emit();
    }
  }
}
