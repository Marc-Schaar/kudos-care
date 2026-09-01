import { Component, computed, inject, input, output, signal } from '@angular/core';
import { BikeAssembly, ComponentSlotList } from '../../models/maintenance.models';
import { BikeService } from '../../services/bike-service/bike-service';
import { AssemblyChecklistComponent } from '../assembly-checklist-component/assembly-checklist-component';
import { WarnLabelPipe } from '../../pipes/warn-label/warn-label-pipe';
import { WarnClassPipe } from '../../pipes/warn-class/warn-class-pipe';
import { NotificationService } from '../../../../shared/services/notification-service/notification-service';

/**
 * "Baugruppe wechseln" — ein Dialog, zwei Wege:
 *
 * 1. Einen **bereits vorhandenen** Satz derselben Gruppe aufziehen (Winter-LRS
 *    aus dem Keller holen). Der aktuell montierte wird dabei geparkt, nicht
 *    ausgemustert: seine Teile bleiben drauf, er sammelt nur keine km mehr.
 * 2. Einen **neuen** Satz anlegen und direkt aufziehen — nutzt dieselbe
 *    `AssemblyChecklistComponent` wie der Hinzufügen-Dialog, nur mit
 *    `activate=true`.
 *
 * Damit hat der Wechsel-Dialog endlich etwas vorzuschlagen; der frühere
 * `QuickChangeDialogComponent` bleibt als "Teile erneuern" daneben bestehen.
 */
@Component({
  selector: 'app-switch-assembly-dialog-component',
  imports: [AssemblyChecklistComponent, WarnLabelPipe, WarnClassPipe],
  templateUrl: './switch-assembly-dialog-component.html',
  styleUrl: './switch-assembly-dialog-component.css',
})
export class SwitchAssemblyDialogComponent {
  /** Die aktuell aufgezogene Baugruppe, aus der heraus gewechselt wird. */
  assembly = input.required<BikeAssembly>();
  /** Alle geparkten Baugruppen des Bikes — hier auf die Gruppe gefiltert. */
  parked = input<BikeAssembly[]>([]);
  /** Ungruppierte Slots des Bikes — für den "vorhandene Komponente übernehmen"-Vorschlag. */
  ungroupedSlots = input<ComponentSlotList[]>([]);

  close = output<void>();
  switched = output<void>();

  private readonly bikeService = inject(BikeService);
  private readonly notify = inject(NotificationService);

  switching = signal<number | null>(null);
  error = signal<string | null>(null);
  showCreate = signal(false);

  /** Nur Alternativen derselben Baugruppe — ein Laufrad ersetzt keinen Antrieb. */
  alternatives = computed(() =>
    this.parked().filter((a) => a.group === this.assembly().group),
  );

  get groupName(): string {
    return this.assembly().group_detail?.name ?? this.assembly().display_name;
  }

  activate(alternative: BikeAssembly) {
    this.error.set(null);
    this.switching.set(alternative.id);
    this.bikeService.activateAssembly(alternative.id).subscribe({
      next: () => {
        this.switching.set(null);
        this.notify.show(
          `"${alternative.display_name}" ist jetzt montiert — "${this.assembly().display_name}" wurde geparkt.`,
          'success',
        );
        this.switched.emit();
      },
      error: (err) => {
        this.switching.set(null);
        this.error.set(err?.error?.error ?? 'Wechsel fehlgeschlagen. Bitte erneut versuchen.');
      },
    });
  }

  openCreate() {
    this.showCreate.set(true);
  }

  back() {
    this.showCreate.set(false);
  }

  onCreated() {
    this.notify.show(`Neue Baugruppe für "${this.groupName}" angelegt und montiert.`, 'success');
    this.switched.emit();
  }

  onOverlayClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('overlay')) {
      this.close.emit();
    }
  }
}
