import { Injectable, signal } from '@angular/core';

/** Kurze Statusmeldung oben im Bild. Wird auch von Screenreadern vorgelesen. */
@Injectable({ providedIn: 'root' })
export class Toasts {
  readonly message = signal('');
  private timer: ReturnType<typeof setTimeout> | null = null;

  show(message: string, ms = 4500): void {
    this.message.set(message);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.message.set(''), ms);
  }
}
