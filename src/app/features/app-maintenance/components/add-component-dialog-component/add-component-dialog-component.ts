import { Component, inject, input, output, signal } from '@angular/core';
import { BikeService } from '../../services/bike-service/bike-service';
import { CreateComponentPayload } from '../../models/maintenance.models';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-add-component-dialog-component',
  imports: [CommonModule, FormsModule],
  templateUrl: './add-component-dialog-component.html',
  styleUrl: './add-component-dialog-component.css',
})
export class AddComponentDialogComponent {
  slotId = input.required<number>();
  bikeDistanceKm = input<number | null>(null);
  close = output<void>();
  saved = output<void>();

  private bikeService = inject(BikeService);

  brand = '';
  modelName = '';
  installedAt = new Date().toISOString().split('T')[0];
  distanceAtInstall: number | null = null;
  notes = '';
  isMounted = true;

  saving = signal(false);
  error = signal<string | null>(null);

  ngOnInit() {
    if (this.bikeDistanceKm() != null) {
      this.distanceAtInstall = this.bikeDistanceKm();
    }
  }

  onSubmit() {
    this.error.set(null);
    this.saving.set(true);

    const payload: CreateComponentPayload = {
      brand: this.brand.trim(),
      model_name: this.modelName.trim(),
      distance_at_install: this.distanceAtInstall,
      installed_at: this.installedAt || null,
      is_mounted: this.isMounted,
      notes: this.notes.trim(),
    };

    this.bikeService.addComponent(this.slotId(), payload).subscribe({
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
