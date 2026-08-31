import { Component, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MaintenanceInterval } from '../../models/maintenance.models';
import { WarnClassPipe } from '../../pipes/warn-class/warn-class-pipe';
import { WarnLabelPipe } from '../../pipes/warn-label/warn-label-pipe';
import { BikeService } from '../../services/bike-service/bike-service';
import { NotificationService } from '../../../../shared/services/notification-service/notification-service';

/**
 * Eine Zeile für ein MaintenanceInterval (Verbrauchsmaterial/Pflege ohne
 * "Zustand"): Label, Status-Ampel, "noch ~X km / Y Tage" und ein
 * "Erledigt / Erneuert"-Button, der die Baseline zurücksetzt.
 */
@Component({
  selector: 'app-interval-row-component',
  imports: [DatePipe, WarnClassPipe, WarnLabelPipe],
  templateUrl: './interval-row-component.html',
  styleUrl: './interval-row-component.css',
})
export class IntervalRowComponent {
  interval = input.required<MaintenanceInterval>();
  logged = output<void>();

  private readonly bikeService = inject(BikeService);
  private readonly notify = inject(NotificationService);

  saving = signal(false);

  remainingKm(): number | null {
    const iv = this.interval();
    if (iv.interval_km == null || iv.km_since == null) return null;
    return Math.round(iv.interval_km - iv.km_since);
  }

  remainingDays(): number | null {
    const iv = this.interval();
    if (iv.interval_days == null || iv.days_since == null) return null;
    return iv.interval_days - iv.days_since;
  }

  markDone() {
    if (this.saving()) return;
    this.saving.set(true);
    this.bikeService.logInterval(this.interval().id).subscribe({
      next: () => {
        this.saving.set(false);
        this.notify.show(`"${this.interval().label}" als erledigt vermerkt.`, 'success');
        this.logged.emit();
      },
      error: () => {
        this.saving.set(false);
        this.notify.show('Konnte nicht gespeichert werden.', 'error');
      },
    });
  }
}
