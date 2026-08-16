import { Component, computed, inject, input, output, signal } from '@angular/core';
import { ComponentSlotList } from '../../models/maintenance.models';
import { WarnClassPipe } from '../../pipes/warn-class/warn-class-pipe';
import { WarnLabelPipe } from '../../pipes/warn-label/warn-label-pipe';
import { DatePipe, DecimalPipe } from '@angular/common';
import { BikeService } from '../../services/bike-service/bike-service';

@Component({
  selector: 'app-slot-card-component',
  imports: [WarnClassPipe, WarnLabelPipe, DatePipe, DecimalPipe],
  templateUrl: './slot-card-component.html',
  styleUrl: './slot-card-component.css',
})
export class SlotCardComponent {
  private readonly bikeService = inject(BikeService);

  slot = input.required<ComponentSlotList>();
  bikeDistanceKm = input<number | null>(null);
  highlighted = input<boolean>(false);
  editComponent = output<number>();
  swapComponent = output<number>();
  checkComponent = output<number>();
  quickChange = output<number>();

  hasGroup = computed(() => this.slot().template_detail.group_name != null);

  wearPct = computed(() => {
    const s = this.slot();
    const comp = s.mounted_component;
    if (!comp || this.bikeDistanceKm() == null) return 0;
    // Wir haben kein warn_km direkt am Slot-List-Objekt,
    // daher zeigen wir den Balken nur wenn der Detail-Slot geladen ist.
    // Hier als Placeholder — wird im SlotDetail erweitert.
    return 0;
  });

  showExplanation = signal(false);
  explanationLoading = signal(false);
  explanation = signal<string | null>(null);
  explanationError = signal<string | null>(null);

  toggleExplanation(componentId: number) {
    const next = !this.showExplanation();
    this.showExplanation.set(next);
    if (next && this.explanation() == null && !this.explanationLoading()) {
      this.explanationLoading.set(true);
      this.explanationError.set(null);
      this.bikeService.fetchWeatherExplanation(componentId).subscribe({
        next: (res) => {
          this.explanationLoading.set(false);
          this.explanation.set(res.explanation);
        },
        error: (err) => {
          this.explanationLoading.set(false);
          this.explanationError.set(
            err?.error?.error ?? 'Erklärung konnte nicht geladen werden.',
          );
        },
      });
    }
  }

  showInstructions = signal(false);
  instructionsLoading = signal(false);
  instructions = signal<string | null>(null);
  instructionsError = signal<string | null>(null);

  toggleInstructions(componentId: number) {
    const next = !this.showInstructions();
    this.showInstructions.set(next);
    if (next && this.instructions() == null && !this.instructionsLoading()) {
      this.instructionsLoading.set(true);
      this.instructionsError.set(null);
      this.bikeService.fetchCheckInstructions(componentId).subscribe({
        next: (res) => {
          this.instructionsLoading.set(false);
          this.instructions.set(res.instructions);
        },
        error: (err) => {
          this.instructionsLoading.set(false);
          this.instructionsError.set(
            err?.error?.error ?? 'Anleitung konnte nicht geladen werden.',
          );
        },
      });
    }
  }
}
