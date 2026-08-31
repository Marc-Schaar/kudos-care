import { Pipe, PipeTransform } from '@angular/core';

/**
 * Beschriftet einen Gegenwind-Wert (positiv = Gegenwind, negativ = Rückenwind).
 *
 * Der neutrale Fall ist bewusst eigenständig: bei reinem Seitenwind oder auf einer
 * Rundfahrt, auf der sich Hin- und Rückweg aufheben, ist der Durchschnitt ~0 — dort
 * „Rückenwind" zu behaupten wäre schlicht falsch.
 */
@Pipe({
  name: 'headwindLabel',
  standalone: true,
})
export class HeadwindLabelPipe implements PipeTransform {
  /** Unterhalb dieser Schwelle (km/h) ist die Richtung nicht mehr aussagekräftig. */
  private static readonly NEUTRAL_THRESHOLD = 0.5;

  transform(value: number | null | undefined): string {
    if (value == null || Math.abs(value) < HeadwindLabelPipe.NEUTRAL_THRESHOLD) {
      return 'Wind neutral';
    }
    return value > 0 ? 'Gegenwind' : 'Rückenwind';
  }
}
