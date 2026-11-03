import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../../../shared/components/icon/icon';
import { Skeleton } from '../../../../shared/components/skeleton/skeleton';
import { NavigationService } from '../../../../shared/services/navigation-service/navigation-service';
import { BikeFormSheet } from '../../components/bike-form-sheet/bike-form-sheet';
import { WarnClassPipe } from '../../pipes/warn-class/warn-class-pipe';
import { WarnLabelPipe } from '../../pipes/warn-label/warn-label-pipe';
import { BikeService } from '../../services/bike-service/bike-service';

/** Die Garage: jedes Rad mit seiner Zeichnung, das dringendste sichtbar an der Ampel. */
@Component({
  selector: 'app-bike-list',
  imports: [BikeFormSheet, DecimalPipe, Icon, RouterLink, Skeleton, WarnClassPipe, WarnLabelPipe],
  templateUrl: './bike-list.html',
  styleUrl: './bike-list.css',
})
export class BikeListPage implements OnInit {
  readonly nav = inject(NavigationService);
  private readonly bikeService = inject(BikeService);

  loading = signal(true);
  creating = signal(false);

  private bikes = this.bikeService.bikes;
  activeBikes = computed(() => this.bikes().filter((bike) => !bike.retired));
  retiredBikes = computed(() => this.bikes().filter((bike) => bike.retired));

  ngOnInit() {
    this.bikeService.fetchBikes().subscribe({
      next: () => this.loading.set(false),
      error: () => this.loading.set(false),
    });
  }

  onCreated(bikeId: number | null) {
    this.creating.set(false);
    if (bikeId != null) this.nav.goTo(this.nav.to.bike(bikeId));
  }
}
