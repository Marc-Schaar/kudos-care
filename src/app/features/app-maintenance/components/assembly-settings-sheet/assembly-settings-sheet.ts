import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { NotificationService } from '../../../../shared/services/notification-service/notification-service';
import { BikeAssembly } from '../../models/maintenance.models';
import { BikeService } from '../../services/bike-service/bike-service';
import { todayIso } from '../../shared/utils/utils';
import { BottomSheet } from '../bottom-sheet/bottom-sheet';

/**
 * Was man mit einer Baugruppe als Ganzem tun kann: umbenennen, Einbaudatum für alle Teile,
 * ausmustern, löschen. Ausmustern ist der Normalfall und behält die Geschichte; Löschen
 * nimmt die Teile samt Verlauf mit und steht deshalb hinter einer Rückfrage.
 */
@Component({
  selector: 'app-assembly-settings-sheet',
  imports: [BottomSheet, FormsModule],
  templateUrl: './assembly-settings-sheet.html',
})
export class AssemblySettingsSheet implements OnInit {
  assembly = input.required<BikeAssembly>();

  closed = output<void>();
  changed = output<void>();
  /** Die Baugruppe gibt es danach nicht mehr: die Seite muss zurück. */
  deleted = output<void>();

  private readonly bikeService = inject(BikeService);
  private readonly notifications = inject(NotificationService);

  readonly today = todayIso();
  name = signal('');
  installedAt = signal(this.today);
  withLinked = signal(true);
  retireOn = signal(this.today);
  busy = signal(false);
  view = signal<'main' | 'retire' | 'delete'>('main');

  partCount = computed(() =>
    this.assembly().slots.reduce(
      (total, slot) =>
        total +
        (slot.mounted_component ? 1 : 0) +
        slot.spare_components.length +
        slot.retired_components.length,
      0,
    ),
  );

  hasPartner = computed(() => this.assembly().linked_assembly_ids.length > 0);

  ngOnInit() {
    this.name.set(this.assembly().name);
    this.installedAt.set(this.assembly().installed_at ?? this.today);
  }

  private act(request: Observable<unknown>, message: string, event: 'changed' | 'deleted') {
    this.busy.set(true);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.notifications.show(message, 'success');
        this[event].emit();
      },
      error: () => this.busy.set(false),
    });
  }

  rename() {
    this.act(
      this.bikeService.renameAssembly(this.assembly().id, this.name().trim()),
      'Gespeichert.',
      'changed',
    );
  }

  setInstalledAt() {
    const assembly = this.assembly();
    this.act(
      this.bikeService.setInstalledAtForAll(assembly.bike, this.installedAt(), assembly.id),
      'Einbaudatum gesetzt. Die km zählen jetzt ab diesem Tag.',
      'changed',
    );
  }

  retire() {
    const assembly = this.assembly();
    const on = this.retireOn() !== this.today ? this.retireOn() : null;
    this.act(
      this.bikeService.retireAssembly(assembly.id, this.hasPartner() && this.withLinked(), on),
      `${assembly.display_name} ist ausgemustert.`,
      'changed',
    );
  }

  delete() {
    const assembly = this.assembly();
    this.act(
      this.bikeService.deleteAssembly(assembly.id),
      `${assembly.display_name} ist gelöscht.`,
      'deleted',
    );
  }
}
