import { Injectable, signal } from '@angular/core';

/** Datenseiten heißen `data`, `data-1` …, dahinter die Karte und das Training. */
export type RidePageKey = 'data' | `data-${number}` | 'map' | 'workout';

/**
 * So lange bleibt die ausgeblendete Bedienleiste nach einem Tipp sichtbar (ms). Kurz, weil
 * die Leiste den Datenfeldern Platz nimmt; wer sie bedient, verlängert sie mit jedem Tipp.
 */
const REVEAL_MS = 3000;

/**
 * Zustand der Fahrtansicht, geteilt zwischen Rahmen, Fahrtseiten und Menü:
 * welche Seite offen ist und ob die Bedienleiste gerade eingeblendet wurde.
 */
@Injectable({ providedIn: 'root' })
export class RideView {
  private timer: ReturnType<typeof setTimeout> | undefined;

  readonly page = signal<RidePageKey>('data');
  /** Zoomstufe der Kartenseite, bleibt beim Blättern erhalten. */
  readonly mapZoom = signal(16);
  /**
   * Eigener Timer statt des Sekundentakts: Am Ticker hinge das Ausblenden bis zu einer
   * Sekunde länger, als eingestellt ist.
   */
  readonly revealed = signal(false);

  show(page: RidePageKey): void {
    this.page.set(page);
  }

  reveal(): void {
    clearTimeout(this.timer);
    this.revealed.set(true);
    this.timer = setTimeout(() => this.revealed.set(false), REVEAL_MS);
  }

  hide(): void {
    clearTimeout(this.timer);
    this.revealed.set(false);
  }

  /** Tipp auf die Fahrtseite: einblenden, oder sofort wieder weg, wenn sie schon steht. */
  toggle(): void {
    if (this.revealed()) this.hide();
    else this.reveal();
  }
}
