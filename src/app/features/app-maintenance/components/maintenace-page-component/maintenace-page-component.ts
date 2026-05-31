import { Component, computed, inject, signal } from '@angular/core';
import { WarnClassPipe } from '../../pipes/warn-class/warn-class-pipe';
import { WarnLabelPipe } from '../../pipes/warn-label/warn-label-pipe';
import { BikeList, WarnStatus } from '../../models/maintenance.models';
import { BikeService } from '../../services/bike-service/bike-service';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-maintenace-page-component',
  imports: [WarnClassPipe, WarnLabelPipe, DecimalPipe, RouterLink],
  templateUrl: './maintenace-page-component.html',
  styleUrl: './maintenace-page-component.css',
})
export class MaintenacePageComponent {
  private bikeService = inject(BikeService);

  public loading = signal(false);
  public allBikes = this.bikeService.bikes;

  public activeBikes = computed(() => this.allBikes().filter((b) => !b.retired));

  public retiredBikes = computed(() => this.allBikes().filter((b) => b.retired));

  public criticalCount = computed(
    () => this.activeBikes().filter((b) => b.warn_status === 'critical').length,
  );

  public warnCount = computed(
    () => this.activeBikes().filter((b) => b.warn_status === 'warn').length,
  );

  ngOnInit() {
    this.loading.set(true);
    this.bikeService.fetchBikes().subscribe({
      complete: () => this.loading.set(false),
    });
  }

  cardClass(bike: BikeList): string {
    const map: Record<WarnStatus, string> = {
      critical: 'card-critical',
      warn: 'card-warn',
      ok: 'card-ok',
      unknown: 'card-unknown',
    };
    return `bike-card ${map[bike.warn_status] ?? 'card-unknown'}`;
  }
}
