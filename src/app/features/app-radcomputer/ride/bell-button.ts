import { Component, inject, input, signal } from '@angular/core';

import { AudioFeedback } from '../core/audio-feedback';

/**
 * Klingel. Als Taste in der Bedienleiste (`key`), als runder Knopf auf der Karte (`map`)
 * oder als Datenfeld (`tile`) — überall derselbe Ton, siehe `AudioFeedback.bell()`.
 */
@Component({
  selector: 'rc-bell',
  template: `
    <button
      type="button"
      [class]="variant()"
      [class.ringing]="ringing()"
      aria-label="Klingeln"
      (click)="ring()"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M5 17h14l-1.6-2.2V11a5.4 5.4 0 0 0-10.8 0v3.8z" />
        <path d="M10 20.2a2.1 2.1 0 0 0 4 0M12 3.2v2.4" />
      </svg>
      @if (variant() === 'tile') {
        <span class="label">Klingel</span>
      }
    </button>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
      min-height: 0;
    }
    button {
      width: 100%;
      height: 100%;
      display: grid;
      place-items: center;
      background: var(--bg);
      color: var(--fg);
    }
    svg {
      fill: none;
      stroke: currentColor;
      stroke-width: 2.4;
      stroke-linejoin: round;
      stroke-linecap: round;
      transform-origin: 50% 15%;
    }
    .key {
      min-height: 60px;
      border: 2px solid var(--edge);
      border-radius: 4px;
    }
    .key svg {
      width: 30px;
      height: 30px;
    }
    .map {
      width: 56px;
      height: 56px;
      border: 2px solid var(--fg);
      border-radius: 50%;
    }
    .map svg {
      width: 30px;
      height: 30px;
    }
    .tile {
      container-type: size;
      align-content: center;
      gap: 4px;
    }
    .tile svg {
      width: 56px;
      height: 56px;
      width: min(40cqw, 50cqh, 96px);
      height: min(40cqw, 50cqh, 96px);
    }
    .label {
      font-family: var(--digits);
      font-size: var(--t-m);
      font-weight: 700;
      color: var(--muted);
    }
    button:active {
      background: var(--fg);
      color: var(--bg);
    }
    .ringing svg {
      animation: ring 0.5s ease-out;
    }
    @keyframes ring {
      20% {
        transform: rotate(16deg);
      }
      45% {
        transform: rotate(-13deg);
      }
      70% {
        transform: rotate(7deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .ringing svg {
        animation: none;
      }
    }
  `,
})
export class BellButton {
  private readonly audio = inject(AudioFeedback);
  readonly variant = input<'key' | 'map' | 'tile'>('key');
  protected readonly ringing = signal(false);
  private timer: ReturnType<typeof setTimeout> | undefined;

  protected ring(): void {
    this.audio.bell();
    this.ringing.set(false);
    clearTimeout(this.timer);
    // Ein Takt Pause, damit die Animation bei schnellem Doppeltipp neu beginnt.
    requestAnimationFrame(() => this.ringing.set(true));
    this.timer = setTimeout(() => this.ringing.set(false), 520);
  }
}
