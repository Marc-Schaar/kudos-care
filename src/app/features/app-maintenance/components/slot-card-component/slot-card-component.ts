import { Component, computed, input, output } from '@angular/core';
import { ComponentSlotList } from '../../models/maintenance.models';
import { WarnClassPipe } from '../../pipes/warn-class/warn-class-pipe';
import { WarnLabelPipe } from '../../pipes/warn-label/warn-label-pipe';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-slot-card-component',
  imports: [WarnClassPipe, WarnLabelPipe, DatePipe],
  templateUrl: './slot-card-component.html',
  styleUrl: './slot-card-component.css',
})
export class SlotCardComponent {
  slot = input.required<ComponentSlotList>();
  bikeDistanceKm = input<number | null>(null);
  highlighted = input<boolean>(false);
  addComponent = output<number>();
  checkComponent = output<number>();

  wearPct = computed(() => {
    const s = this.slot();
    const comp = s.mounted_component;
    if (!comp || this.bikeDistanceKm() == null) return 0;
    // Wir haben kein warn_km direkt am Slot-List-Objekt,
    // daher zeigen wir den Balken nur wenn der Detail-Slot geladen ist.
    // Hier als Placeholder — wird im SlotDetail erweitert.
    return 0;
  });
}
