import { Injectable, computed, inject, signal } from '@angular/core';

import { Ticker } from './ticker';

export type RidePageKey = 'data' | 'avg' | 'lap' | 'map' | 'workout';

/** So lange bleibt die ausgeblendete Bedienleiste nach einem Tipp sichtbar (ms). */
const REVEAL_MS = 6000;

/**
 * Zustand der Fahrtansicht, geteilt zwischen Rahmen, Fahrtseiten und Menü:
 * welche Seite offen ist und ob die Bedienleiste gerade eingeblendet wurde.
 */
@Injectable({ providedIn: 'root' })
export class RideView {
  private readonly ticker = inject(Ticker);
  private readonly revealedUntil = signal(0);

  readonly page = signal<RidePageKey>('data');
  /** Zoomstufe der Kartenseite, bleibt beim Blättern erhalten. */
  readonly mapZoom = signal(16);
  readonly revealed = computed(() => this.ticker.now() < this.revealedUntil());

  show(page: RidePageKey): void {
    this.page.set(page);
  }

  reveal(): void {
    this.revealedUntil.set(Date.now() + REVEAL_MS);
  }

  hide(): void {
    this.revealedUntil.set(0);
  }
}
