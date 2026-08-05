import { Component, inject, input, output, signal } from '@angular/core';
import { BikeService } from '../../services/bike-service/bike-service';
import { ComponentCheckPayload, ComponentTemplate } from '../../models/maintenance.models';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

function suggestedSnooze(value: number | null): number | null {
  if (!value) return null;
  return Math.round(value * 0.2);
}

@Component({
  selector: 'app-component-check-dialog-component',
  imports: [CommonModule, FormsModule],
  templateUrl: './component-check-dialog-component.html',
  styleUrl: './component-check-dialog-component.css',
})
export class ComponentCheckDialogComponent {
  componentId = input.required<number>();
  template = input<ComponentTemplate | null>(null);
  currentConditionPct = input<number | null>(null);
  close = output<void>();
  saved = output<void>();

  private bikeService = inject(BikeService);

  conditionPct: number | null = 50;
  snoozeKm: number | null = null;
  snoozeDays: number | null = null;
  note = '';

  saving = signal(false);
  error = signal<string | null>(null);

  ngOnInit() {
    this.conditionPct = this.currentConditionPct() ?? 50;
    this.snoozeKm = suggestedSnooze(this.template()?.warn_km ?? null);
    this.snoozeDays = suggestedSnooze(this.template()?.warn_days ?? null);
  }

  onSubmit() {
    this.error.set(null);
    this.saving.set(true);

    const payload: ComponentCheckPayload = {
      condition_pct: this.template()?.supports_condition_estimate ? this.conditionPct : null,
      snooze_km: this.snoozeKm,
      snooze_days: this.snoozeDays,
      note: this.note.trim(),
    };

    this.bikeService.checkComponent(this.componentId(), payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.emit();
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.detail ?? 'Fehler beim Speichern. Bitte erneut versuchen.');
      },
    });
  }

  onOverlayClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('overlay')) {
      this.close.emit();
    }
  }
}
