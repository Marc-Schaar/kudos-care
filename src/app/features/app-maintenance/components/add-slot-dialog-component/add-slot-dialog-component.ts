import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BikeService } from '../../services/bike-service/bike-service';
import { BikeType, ComponentTemplate } from '../../models/maintenance.models';

@Component({
  selector: 'app-add-slot-dialog-component',
  imports: [CommonModule, FormsModule],
  templateUrl: './add-slot-dialog-component.html',
  styleUrl: './add-slot-dialog-component.css',
})
export class AddSlotDialogComponent implements OnInit {
  bikeId = input.required<number>();
  bikeType = input.required<BikeType>();
  existingTemplateIds = input<number[]>([]);
  close = output<void>();
  created = output<number>();

  private bikeService = inject(BikeService);

  selectedTemplateId: number | null = null;
  customName = '';

  loading = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);
  allTemplates = signal<ComponentTemplate[]>([]);

  availableTemplates = computed(() => {
    const existing = new Set(this.existingTemplateIds());
    return this.allTemplates()
      .filter((t) => !existing.has(t.id))
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  });

  ngOnInit() {
    this.loading.set(true);
    this.bikeService.fetchTemplates(this.bikeType()).subscribe({
      next: (templates) => {
        this.allTemplates.set(templates);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Vorlagen konnten nicht geladen werden.');
        this.loading.set(false);
      },
    });
  }

  onSubmit() {
    if (this.selectedTemplateId == null) {
      this.error.set('Bitte eine Komponente auswählen.');
      return;
    }
    this.error.set(null);
    this.saving.set(true);

    this.bikeService
      .addSlot(this.bikeId(), this.selectedTemplateId, this.customName.trim())
      .subscribe({
        next: (slot) => {
          this.saving.set(false);
          this.created.emit(slot.id);
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.error?.detail ?? 'Fehler beim Anlegen. Bitte erneut versuchen.');
        },
      });
  }

  onOverlayClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('overlay')) {
      this.close.emit();
    }
  }
}
