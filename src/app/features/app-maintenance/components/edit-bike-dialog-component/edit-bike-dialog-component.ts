import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BikeService } from '../../services/bike-service/bike-service';
import { BIKE_TYPE_LABELS, BikeDetail, BikeType } from '../../models/maintenance.models';

@Component({
  selector: 'app-edit-bike-dialog-component',
  imports: [CommonModule, FormsModule],
  templateUrl: './edit-bike-dialog-component.html',
  styleUrl: './edit-bike-dialog-component.css',
})
export class EditBikeDialogComponent implements OnInit {
  bike = input.required<BikeDetail>();
  close = output<void>();
  saved = output<void>();

  private bikeService = inject(BikeService);

  bikeTypeLabels = BIKE_TYPE_LABELS;
  bikeTypeKeys = Object.keys(BIKE_TYPE_LABELS) as BikeType[];

  name = '';
  bikeType: BikeType = 'other';

  saving = signal(false);
  error = signal<string | null>(null);

  ngOnInit() {
    const b = this.bike();
    this.name = b.name;
    this.bikeType = b.bike_type;
  }

  onSubmit() {
    const trimmedName = this.name.trim();
    if (!trimmedName) {
      this.error.set('Name darf nicht leer sein.');
      return;
    }
    this.error.set(null);
    this.saving.set(true);

    this.bikeService
      .updateBike(this.bike().id, { name: trimmedName, bike_type: this.bikeType })
      .subscribe({
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
