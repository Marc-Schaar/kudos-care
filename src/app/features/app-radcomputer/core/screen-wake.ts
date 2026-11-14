import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

/** Hält den Bildschirm an, wo der Browser das erlaubt. */
@Injectable({ providedIn: 'root' })
export class ScreenWake {
  private readonly doc = inject(DOCUMENT);
  private lock: WakeLockSentinel | null = null;
  private wanted = false;

  readonly supported = 'wakeLock' in navigator;
  readonly active = signal(false);

  constructor() {
    this.doc.addEventListener('visibilitychange', () => {
      // Der Browser gibt die Sperre frei, sobald die Seite verdeckt wird.
      if (this.doc.visibilityState === 'visible' && this.wanted) void this.acquire();
    });
  }

  keepAwake(on: boolean): void {
    this.wanted = on;
    if (on) void this.acquire();
    else void this.lock?.release().catch(() => undefined);
  }

  private async acquire(): Promise<void> {
    if (!this.supported || this.lock) return;
    try {
      const lock = await navigator.wakeLock.request('screen');
      this.lock = lock;
      this.active.set(true);
      lock.addEventListener('release', () => {
        this.lock = null;
        this.active.set(false);
      });
    } catch {
      this.lock = null;
    }
  }
}
