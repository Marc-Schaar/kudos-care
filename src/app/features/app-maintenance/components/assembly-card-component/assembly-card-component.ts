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
 * Karte einer Baugruppe (BikeAssembly) — als Expansion Panel (mobile first: bei
 * vielen Baugruppen wäre alles-immer-offen auf kleinen Screens ein endloser
 * Scroll). Die Kopfzeile trägt Name, Gesamt-Status, Setup-km und die Aktionen
 * und ist selbst der Auf-/Zuklapp-Trigger; darunter die Element-Zeilen
 * (SlotCard) und die Wartungs-Intervalle (IntervalRow).
 *
 * Default-Zustand kommt aus `worst_status`: warn/critical startet offen (nichts
 * Überfälliges soll hinter einem Klick verschwinden), ok/unknown startet zu.
 * Ein manuelles Auf-/Zuklappen überschreibt diesen Default für die Sitzung
 * (`expandOverride`). Ein per Bike-Diagramm hervorgehobenes Teil
 * (`highlightedSlotId`) klappt die Karte IMMER auf, auch gegen einen manuellen
 * Override — sonst liefe `scrollIntoView` ins Leere.
 *
 * Die zwei Wechsel-Aktionen sind bewusst getrennt, weil sie Unterschiedliches tun:
 * "Wechseln" tauscht die ganze Baugruppe gegen einen anderen vorhandenen Satz
 * (Sommer-/Winter-LRS, der alte wird geparkt), "Teile erneuern" ersetzt die
 * verschlissenen Teile *dieses* Satzes durch neue (der alte wird ausgemustert).
 * "Löschen" ist ein hartes Backend-DELETE (Cascade auf Slots/Components/
 * Intervalle/Perioden, siehe `assemblies/<id>/` DELETE) — anders als "Ausmustern"
 * bleibt dabei keine Historie übrig, daher die Zwei-Klick-Bestätigung inline
 * statt eines eigenen Dialogs.
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
  /** Geparkte Sätze des Bikes — nur die Anzahl passender wird hier angezeigt. */
  parkedAssemblies = input<BikeAssembly[]>([]);

  /** Ganze Baugruppe gegen einen anderen Satz tauschen. */
  switchAssembly = output<number>();
  /** Teile dieses Satzes erneuern (Legacy-"Baugruppe tauschen"). */
  swapAssembly = output<number>();
  editComponent = output<number>();
  swapComponent = output<number>();
  checkComponent = output<number>();
  changed = output<void>();
  /** Baugruppe wurde geloescht — Aufrufer muss sie aus seiner Liste entfernen. */
  deleted = output<number>();

  private readonly bikeService = inject(BikeService);
  private readonly notify = inject(NotificationService);

  editingName = signal(false);
  nameDraft = signal('');
  savingName = signal(false);

  confirmingDelete = signal(false);
  deleting = signal(false);

  /** null = folgt dem Default aus worst_status, sonst manuell gesetzt. */
  private expandOverride = signal<boolean | null>(null);

  sortedSlots = computed(() =>
    [...this.assembly().slots].sort(
      (a, b) =>
        a.category.localeCompare(b.category) || a.display_name.localeCompare(b.display_name),
    ),
  );

  /**
   * Ob diese Instanz am Stück gewechselt/erneuert werden kann.
   *
   * Nur bei einer echten Baugruppe (Laufradsatz). Ein Bereich wie Bremse oder
   * Cockpit bündelt Teile, die unabhängig verschleißen — Beläge nach 3.000 km,
   * Scheibe nach 15.000 — und wird pro Zeile einzeln getauscht. Das Backend
   * lehnt activate/swap dort ohnehin mit 400 ab (siehe GroupKind).
   */
  isSwappableAssembly = computed(() => this.assembly().group_detail.kind === 'assembly');

  /** Wie viele geparkte Sätze derselben Gruppe zur Auswahl stehen. */
  alternativeCount = computed(
    () => this.parkedAssemblies().filter((a) => a.group === this.assembly().group).length,
  );

  private defaultExpanded = computed(() => {
    const status = this.assembly().worst_status;
    return status === 'warn' || status === 'critical';
  });

  private hasHighlightedSlot = computed(() => {
    const id = this.highlightedSlotId();
    return id != null && this.assembly().slots.some((s) => s.id === id);
  });

  expanded = computed(
    () => this.hasHighlightedSlot() || (this.expandOverride() ?? this.defaultExpanded()),
  );

  toggleExpanded() {
    this.expandOverride.set(!this.expanded());
  }

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

  requestDelete() {
    this.confirmingDelete.set(true);
  }

  cancelDelete() {
    this.confirmingDelete.set(false);
  }

  confirmDeleteNow() {
    this.deleting.set(true);
    const id = this.assembly().id;
    const name = this.assembly().display_name;
    this.bikeService.deleteAssembly(id).subscribe({
      next: () => {
        this.notify.show(`Baugruppe "${name}" gelöscht.`, 'success');
        this.deleted.emit(id);
      },
      error: () => {
        this.deleting.set(false);
        this.confirmingDelete.set(false);
        this.notify.show('Löschen fehlgeschlagen.', 'error');
      },
    });
  }
}
