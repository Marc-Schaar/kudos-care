import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NotificationService } from '../../../../shared/services/notification-service/notification-service';
import { ActivationPlan, BikeAssembly } from '../../models/maintenance.models';
import { BikeService } from '../../services/bike-service/bike-service';
import { dayParam, todayIso } from '../../shared/utils/utils';
import { BottomSheet } from '../bottom-sheet/bottom-sheet';

/**
 * Laufrad wechseln. Zeigt vorher, was alles passiert — das andere Laufrad des Satzes und
 * die Bremsbeläge wechseln mit, und das soll niemanden überraschen. Die Vorschau kommt vom
 * Server und nutzt dieselbe Rechnung wie der Wechsel selbst.
 */
@Component({
  selector: 'app-switch-sheet',
  imports: [BottomSheet, FormsModule],
  templateUrl: './switch-sheet.html',
})
export class SwitchSheet implements OnInit {
  target = input.required<BikeAssembly>();
  title = input.required<string>();

  closed = output<void>();
  switched = output<void>();
  /** Zu einem Teil fehlt die Zuordnung: der Nutzer möchte sie festlegen. */
  editLinks = output<void>();

  private readonly bikeService = inject(BikeService);
  private readonly notifications = inject(NotificationService);

  readonly today = todayIso();
  plan = signal<ActivationPlan | null>(null);
  busy = signal(false);
  showDate = signal(false);
  on = signal(this.today);

  ngOnInit() {
    this.bikeService.fetchActivationPlan(this.target().id).subscribe((plan) => this.plan.set(plan));
  }

  confirm() {
    this.busy.set(true);
    this.bikeService
      .activateAssembly(this.target().id, this.showDate() ? dayParam(this.on()) : null)
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.notifications.show('Gewechselt. Ab jetzt zählen die km dort.', 'success');
          this.switched.emit();
        },
        error: () => this.busy.set(false),
      });
  }
}
