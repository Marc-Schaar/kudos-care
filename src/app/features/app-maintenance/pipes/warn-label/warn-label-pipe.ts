import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'warnLabel',
})
export class WarnLabelPipe implements PipeTransform {
  transform(value: unknown, ...args: unknown[]): unknown {
    return null;
  }
}
