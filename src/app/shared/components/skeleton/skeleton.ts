import { Component, computed, input } from '@angular/core';

export type SkeletonVariant = 'block' | 'row' | 'bar';

@Component({
  selector: 'app-skeleton',
  imports: [],
  templateUrl: './skeleton.html',
  styleUrl: './skeleton.css',
})
export class Skeleton {
  public variant = input<SkeletonVariant>('block');
  public count = input(1);
  public height = input<string>();
  public width = input<string>();

  protected items = computed(() => Array.from({ length: this.count() }));
}
