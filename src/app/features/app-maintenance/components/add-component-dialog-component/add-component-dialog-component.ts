import { Component, inject, input, output, signal } from '@angular/core';
import { BikeService } from '../../services/bike-service/bike-service';
import { ComponentTemplate, CreateComponentPayload } from '../../models/maintenance.models';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { KmPipe } from '../../pipes/km/km-pipe';

@Component({
  selector: 'app-add-component-dialog-component',
  imports: [CommonModule, FormsModule, KmPipe],
  templateUrl: './add-component-dialog-component.html',
  styleUrl: './add-component-dialog-component.css',
})
export class AddComponentDialogComponent {
  slotId = input.required<number>();
  bikeId = input<number | null>(null);
  bikeDistanceKm = input<number | null>(null);
  template = input<ComponentTemplate | null>(null);
  close = output<void>();
  saved = output<void>();

  private bikeService = inject(BikeService);

  brand = '';
  modelName = '';
  installedAt = new Date().toISOString().split('T')[0];
  distanceAtInstall: number | null = null;
  customWarnKm: number | null = null;
  customWarnDays: number | null = null;
  notes = '';
  isMounted = true;

  // km-Stand wird anhand der Fahrten mit diesem Bike bis zum Einbaudatum
  // automatisch berechnet und ist deshalb standardmäßig gesperrt. Der User
  // kann das Feld manuell freigeben, falls die Berechnung falsch liegt
  // (z.B. weil Aktivitäten in Strava dem falschen Bike zugeordnet waren).
  distanceManuallyEdited = signal(false);
  distanceLoading = signal(false);

  saving = signal(false);
  error = signal<string | null>(null);

  ngOnInit() {
    this.recalculateDistance();
    this.customWarnKm = this.template()?.warn_km ?? null;
    this.customWarnDays = this.template()?.warn_days ?? null;
  }

  onInstalledAtChange() {
    if (!this.distanceManuallyEdited()) {
      this.recalculateDistance();
    }
  }

  enableManualDistance() {
    this.distanceManuallyEdited.set(true);
  }

  disableManualDistance() {
    this.distanceManuallyEdited.set(false);
    this.recalculateDistance();
  }

  private recalculateDistance() {
    const bikeId = this.bikeId();
    if (!bikeId || !this.installedAt) {
      const bikeDistance = this.bikeDistanceKm();
      this.distanceAtInstall = bikeDistance != null ? Math.round(bikeDistance) : null;
      return;
    }

    this.distanceLoading.set(true);
    this.bikeService.fetchDistanceAtDate(bikeId, this.installedAt).subscribe({
      next: (res) => {
        this.distanceLoading.set(false);
        this.distanceAtInstall = Math.round(res.distance_km);
      },
      error: () => {
        this.distanceLoading.set(false);
        const bikeDistance = this.bikeDistanceKm();
        this.distanceAtInstall = bikeDistance != null ? Math.round(bikeDistance) : null;
      },
    });
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
      custom_warn_km: this.customWarnKm,
      custom_warn_days: this.customWarnDays,
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
