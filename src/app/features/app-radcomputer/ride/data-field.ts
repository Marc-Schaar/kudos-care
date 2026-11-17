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
    <span class="head">
      <span class="label">{{ label() }}</span>
      @if (zone(); as z) {
        <span class="zone">Z{{ z }}</span>
      }
    </span>
    <span class="value digits" [style.--n]="chars()">
      <span class="num">{{ value() }}</span>
      @if (showUnit()) {
        <span class="unit">{{ unit() }}</span>
      }
    </span>
    @if (zone(); as z) {
      <span class="lane" aria-hidden="true">
        @for (n of zones; track n) {
          <i [class.on]="n === z"></i>
        }
      </span>
    }
  `,
  host: {
    '[class.hero]': 'size() === "hero"',
    '[class.has-lane]': 'zone() != null',
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
    .head {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-family: var(--digits);
      font-size: var(--t-m);
      font-weight: 700;
      white-space: nowrap;
    }
    .label {
      min-width: 0;
      color: var(--muted);
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .zone {
      flex: none;
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
    /* Die Leitlinie braucht unten 18 px; die Ziffern geben sie ab. */
    :host(.has-lane) .value {
      font-size: min(calc(150cqw / var(--n)), calc(100cqh - 54px));
    }

    /* Zonen-Leitlinie: sieben Striche Z1–Z7, die aktuelle Zone als dicker Block. Dieselbe
       Sprache wie die Seitenanzeige; Z4 (Schwelle) steht genau in der Mitte. Keine
       Zonenfarben: Die Linie folgt dem Aufnahmezustand wie die Ziffern. */
    .lane {
      height: 12px;
      margin-top: 6px;
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 5px;
      align-items: center;
    }
    .lane i {
      height: 3px;
      background: var(--edge);
    }
    .lane i.on {
      height: 11px;
      background: var(--fg);
    }
    :host-context([data-s='idle']) .lane i.on,
    :host-context([data-s='paused']) .lane i.on {
      background: transparent;
      box-shadow: inset 0 0 0 2px var(--fg);
    }
    :host-context([data-s='auto']) .lane i.on {
      background: var(--hold);
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
  /** Leistungszone 1–7; gesetzt zeigt das Feld „Z4“ und die Zonen-Leitlinie. */
  readonly zone = input<number | null>(null);

  protected readonly zones = [1, 2, 3, 4, 5, 6, 7];

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
