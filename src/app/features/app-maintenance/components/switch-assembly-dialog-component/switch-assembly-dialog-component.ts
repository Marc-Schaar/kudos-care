import { Component, computed, inject, input, output, signal } from '@angular/core';
import { BikeAssembly } from '../../models/maintenance.models';
import { BikeService } from '../../services/bike-service/bike-service';
import { WarnLabelPipe } from '../../pipes/warn-label/warn-label-pipe';
import { WarnClassPipe } from '../../pipes/warn-class/warn-class-pipe';
import { NotificationService } from '../../../../shared/services/notification-service/notification-service';

/**
 * "Baugruppe wechseln": einen **bereits vorhandenen** Satz derselben Gruppe
 * aufziehen (Winter-LRS aus dem Keller holen). Der aktuell montierte wird dabei
 * geparkt, nicht ausgemustert — seine Teile bleiben drauf, er sammelt nur keine
 * km mehr.
 *
 * Anlegen kann man hier bewusst **nicht** mehr. Der Dialog hatte dafür eine
 * zweite, eigene `AssemblyChecklistComponent` — damit gab es zwei Stellen mit
 * unterschiedlicher Bedienung, an denen dasselbe entsteht. Angelegt wird nur
 * noch im `AssemblyWizardComponent` (Werkstatt → "+ Baugruppe anlegen"); ein
 * dort angelegter zweiter Satz entsteht geparkt und lässt sich hier aufziehen.
 */
@Component({
  selector: 'app-switch-assembly-dialog-component',
  imports: [WarnLabelPipe, WarnClassPipe],
  templateUrl: './switch-assembly-dialog-component.html',
  styleUrl: './switch-assembly-dialog-component.css',
})
export class SwitchAssemblyDialogComponent {
  /** Die aktuell aufgezogene Baugruppe, aus der heraus gewechselt wird. */
  assembly = input.required<BikeAssembly>();
  /** Alle geparkten Baugruppen des Bikes — hier auf die Gruppe gefiltert. */
  parked = input<BikeAssembly[]>([]);
  close = output<void>();
  switched = output<void>();
  /** Eine der Alternativen wurde geloescht — Aufrufer muss die Liste neu laden. */
  deleted = output<void>();

  private readonly bikeService = inject(BikeService);
  private readonly notify = inject(NotificationService);

  switching = signal<number | null>(null);
  error = signal<string | null>(null);

  /** Zwei-Klick-Bestätigung fürs Löschen einer Alternative (hart, cascadiert). */
  confirmingDeleteId = signal<number | null>(null);
  deletingId = signal<number | null>(null);

  /** Nur Alternativen derselben Baugruppe — ein Laufrad ersetzt keinen Antrieb. */
  alternatives = computed(() => this.parked().filter((a) => a.group === this.assembly().group));

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

  requestDelete(alt: BikeAssembly) {
    this.confirmingDeleteId.set(alt.id);
  }

  cancelDelete() {
    this.confirmingDeleteId.set(null);
  }

  confirmDeleteNow(alt: BikeAssembly) {
    this.deletingId.set(alt.id);
    this.bikeService.deleteAssembly(alt.id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.confirmingDeleteId.set(null);
        this.notify.show(`Baugruppe "${alt.display_name}" gelöscht.`, 'success');
        this.deleted.emit();
      },
      error: () => {
        this.deletingId.set(null);
        this.notify.show('Löschen fehlgeschlagen.', 'error');
      },
    });
  }

  onOverlayClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('overlay')) {
      this.close.emit();
    }
  }
}
