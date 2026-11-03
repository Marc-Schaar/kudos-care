import { Injectable, signal } from '@angular/core';
import { Observable, Subject, take } from 'rxjs';

/**
 * Verbindet den `aiConsentInterceptor` mit dem Dialog in der App-Shell. Laufen mehrere Anfragen
 * gleichzeitig in die fehlende Einwilligung, warten sie auf dieselbe eine Antwort.
 */
@Injectable({ providedIn: 'root' })
export class AiConsentService {
  readonly asking = signal(false);
  private pending?: Subject<boolean>;

  ask(): Observable<boolean> {
    if (!this.pending) {
      this.pending = new Subject<boolean>();
      this.asking.set(true);
    }
    return this.pending.pipe(take(1));
  }

  answer(granted: boolean): void {
    const pending = this.pending;
    this.pending = undefined;
    this.asking.set(false);
    pending?.next(granted);
  }
}
