import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'headwindLabel',
  standalone: true,
})
export class HeadwindLabelPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    if (value != null && value > 0) return 'Gegenwind';
    return 'Rückenwind';
  }
}
