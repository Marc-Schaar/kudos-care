import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { NotificationService } from '../../../../shared/services/notification-service/notification-service';
import { BIKE_TYPE_LABELS, BikeList, BikeType } from '../../models/maintenance.models';
import { BikeService } from '../../services/bike-service/bike-service';
import { todayIso } from '../../shared/utils/utils';
import { BottomSheet } from '../bottom-sheet/bottom-sheet';

/** Rad anlegen oder bearbeiten: Name, Art, Ruhestand, Einbaudatum für alles, löschen. */
@Component({
  selector: 'app-bike-form-sheet',
  imports: [BottomSheet, FormsModule],
  templateUrl: './bike-form-sheet.html',
})
export class BikeFormSheet implements OnInit {
  /** Gesetzt = bearbeiten, null = neu anlegen. */
  bike = input<BikeList | null>(null);

  closed = output<void>();
  /** Beim Anlegen mit der neuen Id, beim Bearbeiten ohne. */
  saved = output<number | null>();
  deleted = output<void>();

  private readonly bikeService = inject(BikeService);
  private readonly notifications = inject(NotificationService);

  readonly today = todayIso();
  readonly types = Object.entries(BIKE_TYPE_LABELS) as [BikeType, string][];

  name = signal('');
  bikeType = signal<BikeType>('road');
  retired = signal(false);
  installedAt = signal(this.today);
  busy = signal(false);
  confirmingDelete = signal(false);

  title = computed(() => (this.bike() ? 'Rad bearbeiten' : 'Neues Rad'));
  /** Ein Strava-Rad taucht beim nächsten Sync wieder auf, nur leer. */
  fromStrava = computed(() => !!this.bike()?.strava_bike_id);

  ngOnInit() {
    const bike = this.bike();
    if (bike) {
      this.name.set(bike.name);
      this.bikeType.set(bike.bike_type);
      this.retired.set(bike.retired);
    }
  }

  private run(request: Observable<unknown>, message: string, done: () => void) {
    this.busy.set(true);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.notifications.show(message, 'success');
        done();
      },
      error: () => this.busy.set(false),
    });
  }

  save() {
    const name = this.name().trim();
    if (!name) return;
    const bike = this.bike();
    if (bike) {
      this.run(
        this.bikeService.updateBike(bike.id, {
          name,
          bike_type: this.bikeType(),
          retired: this.retired(),
        }),
        'Gespeichert.',
        () => this.saved.emit(null),
      );
      return;
    }
    this.busy.set(true);
    this.bikeService.createBike({ name, bike_type: this.bikeType() }).subscribe({
      next: (created) => {
        this.busy.set(false);
        this.saved.emit(created.id);
      },
      error: () => this.busy.set(false),
    });
  }

  setInstalledAt() {
    this.run(
      this.bikeService.setInstalledAtForAll(this.bike()!.id, this.installedAt()),
      'Einbaudatum gesetzt. Die km zählen jetzt ab diesem Tag.',
      () => this.saved.emit(null),
    );
  }

  delete() {
    this.run(this.bikeService.deleteBike(this.bike()!.id), 'Rad gelöscht.', () =>
      this.deleted.emit(),
    );
  }
}
