import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

type TickListener = (now: number, dtMs: number) => void;

/** Sekundentakt der App. Alles Zeitabhängige hängt an `now` oder an `onTick`. */
@Injectable({ providedIn: 'root' })
export class Ticker {
  private readonly doc = inject(DOCUMENT);
  private readonly listeners: TickListener[] = [];
  private last = Date.now();

  readonly now = signal(Date.now());

  constructor() {
    setInterval(() => this.tick(), 1000);
    this.doc.addEventListener('visibilitychange', () => {
      // Nach einer Unterbrechung (Sperre, anderer Tab) keine Phantomzeit zählen.
      if (this.doc.visibilityState === 'visible') this.last = Date.now();
    });
  }

  /** Listener laufen in der Reihenfolge ihrer Anmeldung. */
  onTick(listener: TickListener): void {
    this.listeners.push(listener);
  }

  private tick(): void {
    const now = Date.now();
    const dt = Math.min(now - this.last, 5000);
    this.last = now;
    this.now.set(now);
    for (const listener of this.listeners) listener(now, dt);
  }
}
