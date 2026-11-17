import { Component, inject, signal } from '@angular/core';

import { AudioFeedback } from '../core/audio-feedback';
import { TouchLock } from '../core/touch-lock';

/** So lange muss der Finger auf dem Schloss liegen. Ein Regentropfen tippt, er hält nicht. */
const HOLD_MS = 1200;

/**
 * Sperrfläche über dem ganzen Radcomputer, solange `TouchLock.locked` gilt. Die Anzeige
 * darunter bleibt sichtbar und läuft weiter; nur Berührungen kommen nicht mehr durch.
 */
@Component({
  selector: 'rc-lock-overlay',
  template: `
    <div class="shield" aria-hidden="true" (click)="swallow($event)"></div>
    <button
      type="button"
      class="handle"
      [class.holding]="holding()"
      [style.--hold-ms]="holdMs + 'ms'"
      aria-label="Bildschirm gesperrt. Zum Entsperren gedrückt halten."
      (pointerdown)="start($event)"
      (pointerup)="cancel()"
      (pointercancel)="cancel()"
      (pointerleave)="cancel()"
      (click)="keyboardUnlock($event)"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="5" y="11" width="14" height="10" rx="1.5" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
      <span class="text">{{ holding() ? 'Halten …' : 'Gesperrt · zum Entsperren halten' }}</span>
      <span class="bar" aria-hidden="true"></span>
    </button>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 9;
      touch-action: none;
    }
    .shield {
      position: absolute;
      inset: 0;
      /* Dünner Rahmen in Verkehrsgelb: gesperrt sieht man aus dem Augenwinkel. */
      box-shadow: inset 0 0 0 4px var(--hold);
    }
    .handle {
      position: absolute;
      left: 50%;
      bottom: calc(env(safe-area-inset-bottom) + 84px);
      transform: translateX(-50%);
      width: min(340px, calc(100% - 32px));
      min-height: 60px;
      padding: 0 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      overflow: hidden;
      border: 2px solid var(--hold);
      border-radius: 4px;
      background: var(--bg);
      color: var(--fg);
      font-family: var(--digits);
      font-size: var(--t-l);
      font-weight: 700;
      text-align: left;
    }
    svg {
      width: 28px;
      height: 28px;
      flex: none;
      fill: none;
      stroke: var(--hold);
      stroke-width: 2.4;
      stroke-linejoin: round;
    }
    .bar {
      position: absolute;
      left: 0;
      bottom: 0;
      height: 6px;
      width: 100%;
      background: var(--hold);
      transform: scaleX(0);
      transform-origin: left;
    }
    .holding .bar {
      transform: scaleX(1);
      transition: transform var(--hold-ms) linear;
    }
  `,
})
export class LockOverlay {
  private readonly lock = inject(TouchLock);
  private readonly audio = inject(AudioFeedback);
  protected readonly holdMs = HOLD_MS;
  protected readonly holding = signal(false);
  private timer: ReturnType<typeof setTimeout> | undefined;

  protected swallow(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
  }

  protected start(event: PointerEvent): void {
    event.preventDefault();
    if (this.holding()) return;
    this.holding.set(true);
    this.timer = setTimeout(() => {
      this.holding.set(false);
      this.lock.unlock();
      this.audio.tone('info');
    }, HOLD_MS);
  }

  protected cancel(): void {
    clearTimeout(this.timer);
    this.holding.set(false);
  }

  /** Tastatur (Enter/Leertaste) kennt keinen Regen: dort entsperrt der Klick sofort. */
  protected keyboardUnlock(event: MouseEvent): void {
    if (event.detail === 0) this.lock.unlock();
  }
}
