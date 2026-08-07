import { Component, computed, inject, input, output, signal } from '@angular/core';
import { BikeService } from '../../services/bike-service/bike-service';
import {
  BikeComponent as BikeComponentModel,
  ComponentTemplate,
  CreateComponentPayload,
} from '../../models/maintenance.models';
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
  bikeId = input<number | null>(null);
  bikeDistanceKm = input<number | null>(null);
  template = input<ComponentTemplate | null>(null);
  editComponent = input<BikeComponentModel | null>(null);
  close = output<void>();
  saved = output<void>();

  isEditMode = computed(() => this.editComponent() != null);

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
    const existing = this.editComponent();
    if (existing) {
      this.brand = existing.brand;
      this.modelName = existing.model_name;
      this.installedAt = existing.installed_at ?? this.installedAt;
      this.distanceAtInstall = existing.distance_at_install;
      this.customWarnKm = existing.custom_warn_km;
      this.customWarnDays = existing.custom_warn_days;
      this.notes = existing.notes;
      this.isMounted = existing.is_mounted;
      // vorhandenen km-Stand nicht durch die Auto-Berechnung überschreiben
      this.distanceManuallyEdited.set(true);
      return;
    }

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

    const existing = this.editComponent();
    if (existing) {
      const editPayload: Partial<BikeComponentModel> = {
        brand: this.brand.trim(),
        model_name: this.modelName.trim(),
        distance_at_install: this.distanceAtInstall,
        installed_at: this.installedAt || null,
        notes: this.notes.trim(),
        custom_warn_km: this.customWarnKm,
        custom_warn_days: this.customWarnDays,
      };

      this.bikeService.updateComponent(existing.id, editPayload).subscribe({
        next: () => {
          this.saving.set(false);
          this.saved.emit();
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.error?.detail ?? 'Fehler beim Speichern. Bitte erneut versuchen.');
        },
      });
      return;
    }

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
