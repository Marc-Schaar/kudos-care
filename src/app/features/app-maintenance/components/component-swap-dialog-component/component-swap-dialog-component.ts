import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { BikeService } from '../../services/bike-service/bike-service';
import { BikeComponent as BikeComponentModel } from '../../models/maintenance.models';

@Component({
  selector: 'app-component-swap-dialog-component',
  imports: [CommonModule, DatePipe],
  templateUrl: './component-swap-dialog-component.html',
  styleUrl: './component-swap-dialog-component.css',
})
export class ComponentSwapDialogComponent implements OnInit {
  slotId = input.required<number>();
  close = output<void>();
  mounted = output<void>();
  createNew = output<number>();

  private bikeService = inject(BikeService);

  loading = signal(true);
  mounting = signal<number | null>(null);
  error = signal<string | null>(null);
  unmountedComponents = signal<BikeComponentModel[]>([]);

  ngOnInit() {
    this.bikeService.fetchSlotDetail(this.slotId()).subscribe({
      next: (slot) => {
        this.unmountedComponents.set(slot.components.filter((c) => !c.is_mounted));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Komponenten konnten nicht geladen werden.');
        this.loading.set(false);
      },
    });
  }

  remount(componentId: number) {
    this.error.set(null);
    this.mounting.set(componentId);
    this.bikeService.mountComponent(this.slotId(), componentId).subscribe({
      next: () => {
        this.mounting.set(null);
        this.mounted.emit();
      },
      error: (err) => {
        this.mounting.set(null);
        this.error.set(err?.error?.error ?? 'Montieren fehlgeschlagen. Bitte erneut versuchen.');
      },
    });
  }

  onOverlayClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('overlay')) {
      this.close.emit();
    }
  }
}
