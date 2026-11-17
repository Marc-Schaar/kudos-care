import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

/** Woran der Browser Vollbild erkennen lässt; Safari kennt nur die Präfix-Variante. */
interface FullscreenDocument extends Document {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}
interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

/**
 * Bedienschutz für Regen und Vollbild.
 *
 * Sperre: Wassertropfen lösen auf dem Display Berührungen aus. Gesperrt nimmt eine
 * durchsichtige Fläche über allem jede Berührung an sich; entsperrt wird nur, wer eine
 * Stelle über eine Sekunde lang hält, das schafft kein Tropfen.
 *
 * Vollbild: blendet die Leisten des Browsers aus, wo der Browser es erlaubt. iPhone-Safari
 * (und damit jeder iPhone-Browser) erlaubt es nur für Videos, nicht für Seiten; dort
 * bleibt `fullscreenSupported` falsch und das Menü erklärt es statt eines toten Knopfs.
 */
@Injectable({ providedIn: 'root' })
export class TouchLock {
  private readonly doc = inject(DOCUMENT) as FullscreenDocument;

  readonly locked = signal(false);
  readonly fullscreenSupported = !!(this.doc.fullscreenEnabled || this.doc.webkitFullscreenEnabled);
  readonly fullscreen = signal(false);

  constructor() {
    const sync = (): void =>
      this.fullscreen.set(!!(this.doc.fullscreenElement ?? this.doc.webkitFullscreenElement));
    this.doc.addEventListener('fullscreenchange', sync);
    this.doc.addEventListener('webkitfullscreenchange', sync);
  }

  lock(): void {
    this.locked.set(true);
  }

  unlock(): void {
    this.locked.set(false);
  }

  async toggleFullscreen(): Promise<void> {
    if (!this.fullscreenSupported) return;
    try {
      if (this.fullscreen()) {
        await (this.doc.exitFullscreen?.() ?? this.doc.webkitExitFullscreen?.());
      } else {
        const el = this.doc.documentElement as FullscreenElement;
        await (el.requestFullscreen?.({ navigationUI: 'hide' }) ?? el.webkitRequestFullscreen?.());
      }
    } catch {
      /* abgelehnt, etwa ohne Nutzeraktion */
    }
  }
}
