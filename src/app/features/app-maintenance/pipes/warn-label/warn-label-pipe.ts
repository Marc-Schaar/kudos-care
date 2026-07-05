import { Pipe, PipeTransform } from '@angular/core';
import { WarnStatus } from '../../models/maintenance.models';

@Pipe({
  name: 'warnLabel',
  standalone: true,
})
export class WarnLabelPipe implements PipeTransform {
  transform(status: WarnStatus): string {
    const map: Record<WarnStatus, string> = {
      ok: 'In Ordnung',
      warn: 'Bald fällig',
      critical: 'Überfällig',
      unknown: 'Unbekannt',
    };
    return map[status] ?? 'Unbekannt';
  }
}
