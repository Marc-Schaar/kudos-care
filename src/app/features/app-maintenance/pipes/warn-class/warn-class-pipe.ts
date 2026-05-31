import { Pipe, PipeTransform } from '@angular/core';
import { WarnStatus } from '../../models/maintenance.models';

@Pipe({ name: 'warnClass', standalone: true })
export class WarnClassPipe implements PipeTransform {
  transform(status: WarnStatus): string {
    const map: Record<WarnStatus, string> = {
      ok: 'status-ok',
      warn: 'status-warn',
      critical: 'status-critical',
      unknown: 'status-unknown',
    };
    return map[status] ?? 'status-unknown';
  }
}
