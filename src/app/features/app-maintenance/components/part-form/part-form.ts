import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BikeComponent, ComponentSlot } from '../../models/maintenance.models';
import { BikeService } from '../../services/bike-service/bike-service';
import { dayParam, todayIso } from '../../shared/utils/utils';

/**
 * Teil anlegen oder bearbeiten — dasselbe Formular an beiden Stellen. Liegt ohne eigenes
 * Blatt vor, weil es einmal für sich steht (neuer Reifen) und einmal im Teile-Blatt.
 */
@Component({
  selector: 'app-part-form',
  imports: [FormsModule],
  templateUrl: './part-form.html',
})
export class PartForm implements OnInit {
  slot = input.required<ComponentSlot>();
  /** Gesetzt = bearbeiten, null = neu anlegen. */
  component = input<BikeComponent | null>(null);
  /** Neu anlegen: gleich aufziehen oder ins Regal? */
  defaultMount = input(true);

  saved = output<void>();
  cancelled = output<void>();

  private readonly bikeService = inject(BikeService);

  readonly today = todayIso();
  brand = signal('');
  modelName = signal('');
  notes = signal('');
  mount = signal(true);
  installedAt = signal<string>(this.today);
  priorKm = signal<number | null>(null);
  customWarnKm = signal<number | null>(null);
  customWarnDays = signal<number | null>(null);
  saving = signal(false);

  isEdit = computed(() => this.component() !== null);
  /** Wer noch nie drauf war, hat kein Einbaudatum, das man korrigieren könnte. */
  showDate = computed(() => {
    const component = this.component();
    return component ? component.installed_at !== null : this.mount();
  });

  ngOnInit() {
    const component = this.component();
    this.mount.set(this.defaultMount());
    if (component) {
      this.brand.set(component.brand);
      this.modelName.set(component.model_name);
      this.notes.set(component.notes);
      this.installedAt.set(component.installed_at ?? this.today);
      this.priorKm.set(component.prior_km);
      this.customWarnKm.set(component.custom_warn_km);
      this.customWarnDays.set(component.custom_warn_days);
    }
  }

  save() {
    this.saving.set(true);
    const common = {
      brand: this.brand().trim(),
      model_name: this.modelName().trim(),
      notes: this.notes().trim(),
      prior_km: this.priorKm(),
      custom_warn_km: this.customWarnKm(),
      custom_warn_days: this.customWarnDays(),
    };
    const component = this.component();
    const request = component
      ? this.bikeService.updateComponent(component.id, {
          ...common,
          ...(component.installed_at ? { installed_at: this.installedAt() } : {}),
        })
      : this.bikeService.addComponent(this.slot().id, {
          ...common,
          mount: this.mount(),
          ...(this.mount() && dayParam(this.installedAt())
            ? { installed_at: this.installedAt() }
            : {}),
        });
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
