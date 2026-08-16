import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BikeService } from '../../services/bike-service/bike-service';
import { NotificationService } from '../../../../shared/services/notification-service/notification-service';
import { Skeleton } from '../../../../shared/components/skeleton/skeleton';
import { QuickChangeItem, QuickChangeRequestItem } from '../../models/maintenance.models';

interface QuickChangeRow {
  slotId: number;
  displayName: string;
  include: boolean;
  brand: string;
  modelName: string;
  current: QuickChangeItem['mounted_component'];
}

@Component({
  selector: 'app-quick-change-dialog-component',
  imports: [CommonModule, FormsModule, Skeleton],
  templateUrl: './quick-change-dialog-component.html',
  styleUrl: './quick-change-dialog-component.css',
})
export class QuickChangeDialogComponent implements OnInit {
  slotId = input.required<number>();
  close = output<void>();
  saved = output<void>();

  private bikeService = inject(BikeService);
  private notificationService = inject(NotificationService);

  loading = signal(true);
  saving = signal(false);
  error = signal<string | null>(null);
  groupName = signal<string | null>(null);

  installedAt = new Date().toISOString().split('T')[0];
  rows: QuickChangeRow[] = [];

  ngOnInit() {
    this.bikeService.fetchQuickChangeGroup(this.slotId()).subscribe({
      next: (res) => {
        this.groupName.set(res.group.name);
        this.rows = res.items.map((item) => ({
          slotId: item.slot_id,
          displayName: item.display_name,
          include: item.preselected,
          // Mit aktuellen Werten vorbefüllen: sonst überschreibt jede weiterhin
          // inkludierte Zeile, die der User nicht bewusst neu befüllt, die
          // bestehende Komponente mit leerem Hersteller/Modell (siehe Bugreport:
          // "beim Zurückwechseln geht es nicht mehr sauber").
          brand: item.mounted_component?.brand ?? '',
          modelName: item.mounted_component?.model_name ?? '',
          current: item.mounted_component,
        }));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Baugruppe konnte nicht geladen werden.');
        this.loading.set(false);
      },
    });
  }

  selectedCount(): number {
    return this.rows.filter((row) => row.include).length;
  }

  selectAll() {
    this.rows.forEach((row) => (row.include = true));
  }

  selectNone() {
    this.rows.forEach((row) => (row.include = false));
  }

  onSubmit() {
    if (this.selectedCount() === 0) {
      this.error.set('Bitte mindestens eine Komponente auswählen.');
      return;
    }

    this.error.set(null);
    this.saving.set(true);

    const items: QuickChangeRequestItem[] = this.rows.map((row) => ({
      slot_id: row.slotId,
      include: row.include,
      brand: row.brand.trim(),
      model_name: row.modelName.trim(),
    }));

    const changedCount = this.selectedCount();

    this.bikeService
      .submitQuickChange(this.slotId(), { installed_at: this.installedAt || undefined, items })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.notificationService.show(
            `Baugruppe "${this.groupName()}" gewechselt — ${changedCount} Komponente${changedCount === 1 ? '' : 'n'} aktualisiert.`,
            'success',
          );
          this.saved.emit();
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(
            err?.error?.error ?? 'Baugruppen-Wechsel fehlgeschlagen. Bitte erneut versuchen.',
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
