import { inject, LOCALE_ID, Pipe, PipeTransform } from '@angular/core';
import { formatNumber } from '@angular/common';

@Pipe({ name: 'km', standalone: true })
export class KmPipe implements PipeTransform {
  private locale = inject(LOCALE_ID);

  transform(value: number | null | undefined, digits = '1.0-0'): string | null {
    if (value == null) {
      return null;
    }
    return `${formatNumber(value, this.locale, digits)} km`;
  }
}
