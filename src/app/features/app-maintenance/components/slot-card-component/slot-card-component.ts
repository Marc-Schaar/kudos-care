import { Component, computed, inject, input, output, signal } from '@angular/core';
import { ComponentSlotList } from '../../models/maintenance.models';
import { WarnClassPipe } from '../../pipes/warn-class/warn-class-pipe';
import { WarnLabelPipe } from '../../pipes/warn-label/warn-label-pipe';
import { DatePipe, DecimalPipe } from '@angular/common';
import { BikeService } from '../../services/bike-service/bike-service';
import { wearPercent } from '../../shared/utils/utils';

/**
 * Element-Zeile innerhalb einer Baugruppen-Karte: ein physisches
 * Verschleißteil mit echtem km-/Tage-Balken und den Einzelteil-Aktionen
 * (Bearbeiten, Einzeln tauschen, Prüfen/Freigeben). Der Baugruppen-Tausch
 * sitzt bewusst NICHT hier, sondern an der Baugruppen-Überschrift.
 */
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

  wearPct = computed(() => {
    const comp = this.slot().mounted_component;
    if (!comp) return 0;
    return wearPercent(comp.wear_km, comp.effective_warn_km);
  });

  wearDaysPct = computed(() => {
    const comp = this.slot().mounted_component;
    if (!comp) return 0;
    return wearPercent(comp.wear_days, comp.effective_warn_days);
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
