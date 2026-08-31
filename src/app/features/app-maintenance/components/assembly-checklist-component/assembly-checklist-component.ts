import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AssemblyIntervalItem,
  AssemblyPartItem,
  BikeAssembly,
  ComponentGroupCatalog,
  ComponentTemplate,
  CreateAssemblyPayload,
} from '../../models/maintenance.models';
import { BikeService } from '../../services/bike-service/bike-service';

interface PartRow {
  template: ComponentTemplate;
  include: boolean;
  brand: string;
  modelName: string;
}

interface IntervalRow {
  template: ComponentTemplate;
  include: boolean;
  intervalKm: number | null;
  intervalDays: number | null;
}

/**
 * Wiederverwendbare Checkliste zum Anlegen EINER Baugruppe: alle Teile +
 * Verbrauchsmaterial der gewählten `group`, gemeinsames Einbaudatum, optionaler
 * Baugruppen-Name. Wird sowohl vom AddAssemblyDialog als auch vom
 * Bike-Setup-Stepper genutzt. Der Aufrufer steuert die Button-Beschriftungen
 * und ob ein "Überspringen" angeboten wird.
 */
@Component({
  selector: 'app-assembly-checklist-component',
  imports: [FormsModule],
  templateUrl: './assembly-checklist-component.html',
  styleUrl: './assembly-checklist-component.css',
})
export class AssemblyChecklistComponent implements OnInit {
  bikeId = input.required<number>();
  group = input.required<ComponentGroupCatalog>();
  saveLabel = input<string>('Baugruppe anlegen');
  showSkip = input<boolean>(false);
  showName = input<boolean>(true);

  created = output<BikeAssembly>();
  skipped = output<void>();

  private readonly bikeService = inject(BikeService);

  name = '';
  installedAt = new Date().toISOString().split('T')[0];
  partRows: PartRow[] = [];
  intervalRows: IntervalRow[] = [];

  saving = signal(false);
  error = signal<string | null>(null);

  selectedCount = computed(
    () =>
      this.partRows.filter((r) => r.include).length +
      this.intervalRows.filter((r) => r.include).length,
  );

  ngOnInit() {
    const g = this.group();
    this.partRows = g.parts.map((t) => ({
      template: t,
      include: t.default_in_group,
      brand: '',
      modelName: '',
    }));
    this.intervalRows = g.consumables.map((t) => ({
      template: t,
      include: t.default_in_group,
      intervalKm: t.warn_km,
      intervalDays: t.warn_days,
    }));
  }

  buildPayload(): CreateAssemblyPayload {
    const parts: AssemblyPartItem[] = this.partRows.map((r) => ({
      template_id: r.template.id,
      include: r.include,
      brand: r.brand.trim(),
      model_name: r.modelName.trim(),
    }));
    const intervals: AssemblyIntervalItem[] = this.intervalRows.map((r) => ({
      template_id: r.template.id,
      include: r.include,
      interval_km: r.intervalKm,
      interval_days: r.intervalDays,
    }));
    return {
      group_id: this.group().id,
      name: this.name.trim(),
      installed_at: this.installedAt || undefined,
      parts,
      intervals,
    };
  }

  save() {
    if (this.selectedCount() === 0) {
      this.error.set('Bitte mindestens ein Element auswählen.');
      return;
    }
    this.error.set(null);
    this.saving.set(true);
    this.bikeService.createAssembly(this.bikeId(), this.buildPayload()).subscribe({
      next: (assembly) => {
        this.saving.set(false);
        this.created.emit(assembly);
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.error ?? 'Anlegen fehlgeschlagen. Bitte erneut versuchen.');
      },
    });
  }
}
