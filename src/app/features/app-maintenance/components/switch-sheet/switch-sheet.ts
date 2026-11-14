import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Icon } from '../../../../shared/components/icon/icon';
import { NotificationService } from '../../../../shared/services/notification-service/notification-service';
import { ActivationPlan, BikeAssembly } from '../../models/maintenance.models';
import { BikeService } from '../../services/bike-service/bike-service';
import { dayParam, todayIso } from '../../shared/utils/utils';
import { BottomSheet } from '../bottom-sheet/bottom-sheet';

/** Eine Stelle am Rad: was dort ankommt und was dafür in den Keller geht. */
export interface SwapRow {
  key: string;
  where: string;
  on: string | null;
  off: string | null;
}

/**
 * Legt die Vorschau des Servers als Tauschliste aus: je Stelle am Rad eine Zeile, links was
 * ans Rad kommt, rechts was in den Keller geht. Laufräder paaren sich über ihre Gruppe
 * ("Laufrad vorne" gegen "Laufrad vorne"), mitwechselnde Teile über ihren Platz.
 */
export function buildSwapRows(plan: ActivationPlan): SwapRow[] {
  const parked = new Map(plan.park.map((item) => [item.group_name, item]));
  const rows: SwapRow[] = plan.activate.map((item) => {
    const off = parked.get(item.group_name) ?? null;
    parked.delete(item.group_name);
    return { key: `a${item.id}`, where: item.group_name, on: item.name, off: off?.name ?? null };
  });
  for (const item of parked.values()) {
    rows.push({ key: `p${item.id}`, where: item.group_name, on: null, off: item.name });
  }
  for (const item of plan.mount) {
    rows.push({
      key: `m${item.component_id}`,
      where: item.slot_name,
      on: item.label,
      off: item.replaces,
    });
  }
  return rows;
}

/**
 * Laufrad wechseln. Zeigt vorher, was alles passiert — das andere Laufrad des Satzes und
 * die Bremsbeläge wechseln mit, und das soll niemanden überraschen. Die Vorschau kommt vom
 * Server und nutzt dieselbe Rechnung wie der Wechsel selbst.
 */
@Component({
  selector: 'app-switch-sheet',
  imports: [BottomSheet, FormsModule, Icon],
  templateUrl: './switch-sheet.html',
  styleUrl: './switch-sheet.css',
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
  rows = computed(() => {
    const plan = this.plan();
    return plan ? buildSwapRows(plan) : [];
  });
  /** Ob überhaupt etwas in den Keller geht: sonst braucht es den Satz dazu nicht. */
  parksSomething = computed(() => this.rows().some((row) => row.off !== null));
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
