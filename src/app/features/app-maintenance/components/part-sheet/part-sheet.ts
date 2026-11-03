import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { NotificationService } from '../../../../shared/services/notification-service/notification-service';
import {
  AssembliesResponse,
  BikeAssembly,
  BikeComponent,
  ComponentSlot,
} from '../../models/maintenance.models';
import { WarnClassPipe } from '../../pipes/warn-class/warn-class-pipe';
import { WarnLabelPipe } from '../../pipes/warn-label/warn-label-pipe';
import { BikeService } from '../../services/bike-service/bike-service';
import { dayParam, moveTargets, todayIso } from '../../shared/utils/utils';
import { BottomSheet } from '../bottom-sheet/bottom-sheet';
import { PartForm } from '../part-form/part-form';
import { WearMeter } from '../wear-meter/wear-meter';

type View = 'main' | 'edit' | 'check' | 'move' | 'delete';

/**
 * Alles zu einem einzelnen Teil: wie es steht, wo es war, und was man damit tun kann.
 * Welche Aktionen es gibt, hängt am Zustand — montiert, im Regal oder ausgemustert. Nach
 * jeder Aktion lädt die Seite neu, deshalb schließt sich das Blatt dann.
 */
@Component({
  selector: 'app-part-sheet',
  imports: [
    BottomSheet,
    DatePipe,
    DecimalPipe,
    FormsModule,
    PartForm,
    WarnClassPipe,
    WarnLabelPipe,
    WearMeter,
  ],
  templateUrl: './part-sheet.html',
  styleUrl: './part-sheet.css',
})
export class PartSheet {
  component = input.required<BikeComponent>();
  slot = input.required<ComponentSlot>();
  /** Die Baugruppe des Platzes. Null bei Alt-Plätzen ohne Baugruppe. */
  assembly = input<BikeAssembly | null>(null);
  garage = input.required<AssembliesResponse>();

  closed = output<void>();
  changed = output<void>();

  private readonly bikeService = inject(BikeService);
  private readonly notifications = inject(NotificationService);

  readonly today = todayIso();
  view = signal<View>('main');
  busy = signal(false);
  showDate = signal(false);
  actionDate = signal(this.today);

  // Prüfen
  conditionPct = signal<number | null>(null);
  snoozeKm = signal<number | null>(null);
  snoozeDays = signal<number | null>(null);
  checkNote = signal('');

  // Umziehen
  moveSlotId = signal<number | null>(null);
  moveMount = signal(true);

  // KI-Texte, erst auf Klick geladen: die Generierung kostet einen AI-Call.
  instructions = signal<string | null>(null);
  instructionsLoading = signal(false);
  weatherText = signal<string | null>(null);
  weatherLoading = signal(false);

  statusLabel = computed(() => {
    const assembly = this.assembly();
    switch (this.component().status) {
      case 'mounted':
        return assembly?.is_active === false ? 'Auf dem Laufrad im Keller' : 'Montiert';
      case 'spare':
        return 'Im Regal';
      case 'retired':
        return 'Ausgemustert';
    }
  });

  /** Sitzt das Teil auf einem ausgemusterten Laufrad, braucht es erst einen neuen Platz. */
  canMountHere = computed(() => !this.assembly()?.is_retired);

  targets = computed(() =>
    moveTargets(this.garage(), this.slot().template, this.slot().id).filter(
      ({ assembly }) => !assembly.is_retired,
    ),
  );

  kmRatio = computed(() => {
    const component = this.component();
    return component.effective_warn_km ? component.wear_km / component.effective_warn_km : null;
  });

  daysRatio = computed(() => {
    const component = this.component();
    return component.effective_warn_days && component.wear_days != null
      ? component.wear_days / component.effective_warn_days
      : null;
  });

  weatherExtra = computed(() => {
    const component = this.component();
    if (component.weather_wear_km == null) return 0;
    return Math.round(component.weather_wear_km - component.wear_km);
  });

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

  private on(): string | null {
    return this.showDate() ? dayParam(this.actionDate()) : null;
  }

  mount() {
    const component = this.component();
    this.act(
      this.bikeService.mountComponent(component.id, this.on()),
      `${component.label} ist drauf. Ab jetzt zählen die km hierfür.`,
    );
  }

  unmount() {
    const component = this.component();
    this.act(
      this.bikeService.unmountComponent(component.id, this.on()),
      `${component.label} liegt jetzt im Regal.`,
    );
  }

  retire() {
    const component = this.component();
    this.act(
      this.bikeService.retireComponent(component.id, this.on()),
      `${component.label} ist ausgemustert.`,
    );
  }

  restore() {
    const component = this.component();
    this.act(
      this.bikeService.restoreComponent(component.id),
      `${component.label} liegt wieder im Regal.`,
    );
  }

  delete() {
    const component = this.component();
    this.act(this.bikeService.deleteComponent(component.id), `${component.label} ist gelöscht.`);
  }

  startMove() {
    this.moveSlotId.set(this.targets()[0]?.slot.id ?? null);
    this.view.set('move');
  }

  move() {
    const slotId = this.moveSlotId();
    if (slotId == null) return;
    const component = this.component();
    this.act(
      this.bikeService.moveComponent(component.id, slotId, this.moveMount(), this.on()),
      `${component.label} ist umgezogen und nimmt seine km mit.`,
    );
  }

  check() {
    this.act(
      this.bikeService.checkComponent(this.component().id, {
        condition_pct: this.conditionPct(),
        snooze_km: this.snoozeKm(),
        snooze_days: this.snoozeDays(),
        note: this.checkNote().trim(),
      }),
      'Geprüft. Der Status zählt ab jetzt neu.',
    );
  }

  undoCheck() {
    this.act(this.bikeService.undoCheck(this.component().id), 'Prüfung zurückgenommen.');
  }

  loadInstructions() {
    this.instructionsLoading.set(true);
    this.bikeService.fetchCheckInstructions(this.component().id).subscribe({
      next: (res) => {
        this.instructions.set(res.instructions);
        this.instructionsLoading.set(false);
      },
      error: () => this.instructionsLoading.set(false),
    });
  }

  loadWeatherText() {
    this.weatherLoading.set(true);
    this.bikeService.fetchWeatherExplanation(this.component().id).subscribe({
      next: (res) => {
        this.weatherText.set(res.explanation);
        this.weatherLoading.set(false);
      },
      error: () => this.weatherLoading.set(false),
    });
  }

  onEdited() {
    this.notifications.show('Gespeichert.', 'success');
    this.changed.emit();
  }
}
