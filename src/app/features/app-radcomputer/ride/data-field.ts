import { Component, computed, input } from '@angular/core';

import { DASH } from '../core/format';

/**
 * Ein Datenfeld: Beschriftung oben, darunter der Wert mit seiner Einheit auf derselben
 * Grundlinie („149 bpm“), damit das Auge nicht quer über das Feld springen muss.
 *
 * Die Ziffern wachsen mit dem Feld (Container-Einheiten), nicht mit dem Bildschirm: Seit
 * die Datenseiten frei belegbar sind, kann ein Feld die halbe Seite oder ein Achtel sein.
 * Die Breite teilt sich durch die Zeichenzahl, damit „1:23:45“ so gut passt wie „25,3“.
 *
 * Volle Ziffern heißt: die Uhr läuft. Solange nichts aufgezeichnet wird (bereit, pausiert,
 * Auto-Pause), stehen die Werte nur als Umriss da, bei Auto-Pause in Verkehrsgelb. Das ist
 * eine Formänderung, kein reiner Farbwechsel: auf Armlänge und für Farbenblinde lesbar.
 */
@Component({
  selector: 'rc-data-field',
  template: `
    <span class="label">{{ label() }}</span>
    <span class="value digits" [style.--n]="chars()">
      <span class="num">{{ value() }}</span>
      @if (showUnit()) {
        <span class="unit">{{ unit() }}</span>
      }
    </span>
  `,
  host: {
    '[class.hero]': 'size() === "hero"',
  },
  styles: `
    :host {
      container-type: size;
      background: var(--bg);
      min-width: 0;
      min-height: 0;
      padding: 8px var(--gutter) 6px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .label {
      font-family: var(--digits);
      font-size: var(--t-m);
      font-weight: 700;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .value {
      line-height: 0.9;
      letter-spacing: -0.02em;
      white-space: nowrap;
      /* Ohne Container-Einheiten (sehr alte Browser) die frühere Größe. */
      font-size: min(15.5vw, 9.5vh);
      font-size: min(calc(150cqw / var(--n)), calc(100cqh - 36px));
    }
    :host(.hero) .value {
      font-size: min(31vw, 17vh);
      font-size: min(calc(150cqw / var(--n)), calc(100cqh - 36px));
    }
    .unit {
      margin-left: 0.14em;
      font-size: max(var(--t-m), 0.27em);
      letter-spacing: 0;
      color: var(--muted);
    }

    /* Keine Aufzeichnung: Umrissziffern. Der Strich wächst mit der Schrift mit.
       Er liegt unter einer Füllung in Hintergrundfarbe und ist deshalb doppelt so breit
       angesetzt: Die DIN setzt „1“ und „:“ aus überlappenden Formen zusammen, deren
       innere Nähte ein reiner Umriss sichtbar nachzeichnen würde. */
    :host-context([data-s='idle']) .num,
    :host-context([data-s='paused']) .num,
    :host-context([data-s='auto']) .num {
      color: var(--bg);
      -webkit-text-stroke: max(3px, 0.07em) var(--fg);
      paint-order: stroke fill;
    }
    :host-context([data-s='auto']) .num {
      -webkit-text-stroke-color: var(--hold);
    }
  `,
})
export class DataField {
  readonly label = input.required<string>();
  readonly unit = input('');
  readonly value = input.required<string>();
  readonly size = input<'normal' | 'wide' | 'hero'>('normal');

  /** Ohne Wert („--“) hat die Einheit nichts, woran sie stehen könnte. */
  protected readonly showUnit = computed(() => !!this.unit() && this.value() !== DASH);

  /**
   * Breite des Werts in Ziffernbreiten: Die Einheit steht in gut einem Viertel der Größe
   * daneben. Mindestens drei, sonst würde eine einzelne Ziffer riesig.
   */
  protected readonly chars = computed(() => {
    const unit = this.showUnit() ? this.unit().length * 0.3 + 0.2 : 0;
    return Math.max(3, this.value().length + unit);
  });
}
