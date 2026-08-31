import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BikeService } from '../../services/bike-service/bike-service';
import { NotificationService } from '../../../../shared/services/notification-service/notification-service';
import {
  AssemblyIntervalItem,
  AssemblyPartItem,
  BikeAssembly,
} from '../../models/maintenance.models';

interface PartRow {
  templateId: number;
  displayName: string;
  include: boolean;
  brand: string;
  modelName: string;
  currentBrand: string;
}

interface IntervalRow {
  templateId: number | null;
  label: string;
  include: boolean;
}

/**
 * "Baugruppe tauschen": ersetzt die komplette aktive BikeAssembly durch eine
 * neue Instanz derselben Gruppe. Vorbefüllt aus den aktuell montierten Teilen;
 * der User passt Marke/Modell an und wählt ab, was gleich bleibt.
 */
@Component({
  selector: 'app-quick-change-dialog-component',
  imports: [CommonModule, FormsModule],
  templateUrl: './quick-change-dialog-component.html',
  styleUrl: './quick-change-dialog-component.css',
})
export class QuickChangeDialogComponent implements OnInit {
  assembly = input.required<BikeAssembly>();
  close = output<void>();
  saved = output<void>();

  private readonly bikeService = inject(BikeService);
  private readonly notify = inject(NotificationService);

  saving = signal(false);
  error = signal<string | null>(null);

  installedAt = new Date().toISOString().split('T')[0];
  partRows: PartRow[] = [];
  intervalRows: IntervalRow[] = [];

  ngOnInit() {
    this.partRows = this.assembly().slots.map((slot) => ({
      templateId: slot.template,
      displayName: slot.display_name,
      include: true,
      brand: slot.mounted_component?.brand ?? '',
      modelName: slot.mounted_component?.model_name ?? '',
      currentBrand: slot.mounted_component?.brand ?? '',
    }));
    this.intervalRows = this.assembly()
      .intervals.filter((iv) => iv.template != null)
      .map((iv) => ({ templateId: iv.template, label: iv.label, include: true }));
  }

  get groupName(): string {
    return this.assembly().display_name;
  }

  selectedCount(): number {
    return (
      this.partRows.filter((r) => r.include).length +
      this.intervalRows.filter((r) => r.include).length
    );
  }

  selectAll() {
    this.partRows.forEach((r) => (r.include = true));
    this.intervalRows.forEach((r) => (r.include = true));
  }

  selectNone() {
    this.partRows.forEach((r) => (r.include = false));
    this.intervalRows.forEach((r) => (r.include = false));
  }

  onSubmit() {
    if (this.selectedCount() === 0) {
      this.error.set('Bitte mindestens ein Element auswählen.');
      return;
    }
    this.error.set(null);
    this.saving.set(true);

    const parts: AssemblyPartItem[] = this.partRows.map((r) => ({
      template_id: r.templateId,
      include: r.include,
      brand: r.brand.trim(),
      model_name: r.modelName.trim(),
    }));
    const intervals: AssemblyIntervalItem[] = this.intervalRows.map((r) => ({
      template_id: r.templateId!,
      include: r.include,
    }));

    const changedCount = this.selectedCount();

    this.bikeService
      .swapAssembly(this.assembly().id, {
        installed_at: this.installedAt || undefined,
        parts,
        intervals,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.notify.show(
            `Baugruppe "${this.groupName}" getauscht — ${changedCount} Element${changedCount === 1 ? '' : 'e'} erneuert.`,
            'success',
          );
          this.saved.emit();
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(
            err?.error?.error ?? 'Baugruppen-Tausch fehlgeschlagen. Bitte erneut versuchen.',
          );
        },
      });
  }

  onOverlayClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('overlay')) {
      this.close.emit();
    }
  }
}
