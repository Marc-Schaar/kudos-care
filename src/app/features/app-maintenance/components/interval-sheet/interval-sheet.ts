import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { NotificationService } from '../../../../shared/services/notification-service/notification-service';
import { MaintenanceInterval } from '../../models/maintenance.models';
import { BikeService } from '../../services/bike-service/bike-service';
import { todayIso } from '../../shared/utils/utils';
import { BottomSheet } from '../bottom-sheet/bottom-sheet';

/** Pflege anlegen, ändern, löschen, einen versehentlichen "Erledigt"-Eintrag zurücknehmen. */
@Component({
  selector: 'app-interval-sheet',
  imports: [BottomSheet, FormsModule],
  templateUrl: './interval-sheet.html',
})
export class IntervalSheet implements OnInit {
  bikeId = input.required<number>();
  assemblyId = input<number | null>(null);
  /** Gesetzt = bearbeiten, null = neu anlegen. */
  interval = input<MaintenanceInterval | null>(null);

  closed = output<void>();
  changed = output<void>();

  private readonly bikeService = inject(BikeService);
  private readonly notifications = inject(NotificationService);

  readonly today = todayIso();
  label = signal('');
  intervalKm = signal<number | null>(null);
  intervalDays = signal<number | null>(null);
  lastDoneAt = signal(this.today);
  busy = signal(false);
  confirmingDelete = signal(false);

  title = computed(() => this.interval()?.label ?? 'Neue Pflege');

  ngOnInit() {
    const interval = this.interval();
    if (interval) {
      this.label.set(interval.label);
      this.intervalKm.set(interval.interval_km);
      this.intervalDays.set(interval.interval_days);
      this.lastDoneAt.set(interval.last_done_at ?? this.today);
    }
  }

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

  save() {
    const label = this.label().trim();
    if (!label) return;
    const fields = {
      label,
      interval_km: this.intervalKm(),
      interval_days: this.intervalDays(),
      last_done_at: this.lastDoneAt(),
    };
    const interval = this.interval();
    this.act(
      interval
        ? this.bikeService.updateInterval(interval.id, fields)
        : this.bikeService.addInterval(this.bikeId(), { ...fields, assembly: this.assemblyId() }),
      'Gespeichert.',
    );
  }

  undoLast() {
    this.act(this.bikeService.undoIntervalLog(this.interval()!.id), 'Eintrag zurückgenommen.');
  }

  delete() {
    this.act(this.bikeService.deleteInterval(this.interval()!.id), 'Pflege gelöscht.');
  }
}
