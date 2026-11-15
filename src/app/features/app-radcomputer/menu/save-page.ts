import { Component, computed, inject, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { Router } from '@angular/router';

import { fmtTime, num } from '../core/format';
import { RideRecorder } from '../core/ride-recorder';
import { SHAPE_H, SHAPE_W, defaultRideName, routeShape } from '../core/ride-summary';
import { RideSync } from '../core/ride-sync';
import { Strava } from '../core/strava';
import { Toasts } from '../core/toasts';
import { SubHeader } from './sub-header';
import { RC } from '../core/paths';

/** So lange bleibt „Verwerfen“ nach dem ersten Tippen scharf. */
const DISCARD_ARM_MS = 4000;

/**
 * Fahrt zu Strava senden, als Datei exportieren oder verwerfen.
 *
 * Aufbau nach Gewicht: oben die eigene Strecke und die Zahlen, dann genau eine Hauptaktion
 * (Strava), darunter der Export, ganz unten und abgesetzt das Verwerfen.
 */
@Component({
  selector: 'rc-save-page',
  imports: [FormField, SubHeader],
  template: `
    <div class="scroll">
      <rc-sub-header [title]="ride.status() === 'idle' ? 'Fahrt speichern' : 'Fahrt abschließen'" />

      @if (ride.hasData()) {
        @if (route(); as r) {
          <svg
            class="route"
            [attr.viewBox]="viewBox"
            role="img"
            aria-label="Gefahrene Strecke, Ring ist der Start, Punkt das Ziel"
          >
            <path class="line" [attr.d]="r.d" pathLength="1" />
            <circle class="end" [attr.cx]="r.end[0]" [attr.cy]="r.end[1]" r="13" />
            <circle class="start" [attr.cx]="r.start[0]" [attr.cy]="r.start[1]" r="22" />
          </svg>
        }
        <dl class="facts">
          <div>
            <dt>Fahrzeit</dt>
            <dd class="digits">{{ facts().time }}</dd>
          </div>
          <div>
            <dt>Distanz <span>km</span></dt>
            <dd class="digits">{{ facts().km }}</dd>
          </div>
          <div>
            <dt>Anstieg <span>m</span></dt>
            <dd class="digits">{{ facts().ascent }}</dd>
          </div>
        </dl>
        @if (facts().extra) {
          <p class="extra">{{ facts().extra }}</p>
        }
        @if (!route()) {
          <p class="hint">Ohne GPS-Strecke aufgezeichnet, deshalb gibt es keine Karte.</p>
        }
      } @else {
        <p class="hint empty">
          Noch nichts aufgezeichnet. Starte die Aufnahme auf der Fahrtseite, dann landet die Fahrt
          hier.
        </p>
      }

      <form class="stack strava" (submit)="upload($event)">
        <div class="form-row">
          <label for="up-name">Titel für Strava</label>
          <input
            id="up-name"
            type="text"
            [formField]="uploadForm.name"
            [placeholder]="suggestedName()"
            autocomplete="off"
            enterkeyhint="send"
          />
        </div>
        <label class="check-row">
          Als Pendelfahrt markieren
          <input type="checkbox" [formField]="uploadForm.commute" />
        </label>

        @if (strava.canUpload()) {
          @if (ride.status() === 'running') {
            <p class="hint">Die Aufnahme läuft noch. Senden beendet sie.</p>
          }
          <button
            type="submit"
            class="btn primary send"
            [class.busy]="sync.uploading()"
            [disabled]="!ride.hasData() || sync.uploading()"
          >
            {{ sendLabel() }}
          </button>
          <p class="sr-only" aria-live="polite">{{ sync.uploading() ? sendLabel() : '' }}</p>
          @if (uploadError(); as err) {
            <div class="problem" role="alert">
              <span class="sense" data-state="err" aria-hidden="true"></span>
              <div>
                <p class="problem-title">{{ err }}</p>
                <p class="hint">
                  Die Fahrt bleibt auf dem Gerät. Versuch es noch einmal oder exportiere sie unten
                  als Datei.
                </p>
              </div>
            </div>
          }
        } @else {
          <button
            type="button"
            class="btn primary"
            (click)="strava.grantUpload()"
            [disabled]="strava.busy()"
          >
            Upload bei Strava freischalten
          </button>
          <p class="hint">
            Bei der Anmeldung nicht erlaubt: Strava fragt noch einmal, ob Kudos Care Aktivitäten
            hochladen darf.
          </p>
        }
      </form>

      <h3 class="section-title">Als Datei sichern</h3>
      <div class="stack">
        @if (exported()) {
          <p class="saved">
            <span class="sense" data-state="on" aria-hidden="true"></span>
            TCX-Datei gesichert
          </p>
          @if (ride.status() !== 'idle') {
            <button type="button" class="btn" (click)="finish('Fahrt abgeschlossen.')">
              Fahrt abschließen
            </button>
            <p class="hint">
              Danach ist der Radcomputer bereit für die nächste Fahrt. Zu Strava senden kannst du
              sie vorher trotzdem noch.
            </p>
          }
        }
        <button type="button" class="btn" (click)="exportFile()" [disabled]="!ride.hasData()">
          {{ exported() ? 'Noch einmal exportieren' : 'Als TCX-Datei exportieren' }}
        </button>
        @if (!exported()) {
          <p class="hint">
            Für Garmin Connect: Garmin nimmt Fahrten fremder Apps nicht direkt an. Exportiere die
            Datei und lade sie in Garmin Connect im Browser über „Importieren“ hoch.
          </p>
        }
      </div>

      @if (ride.status() !== 'idle') {
        <div class="discard">
          <button
            type="button"
            class="btn danger"
            [class.armed]="discardArmed()"
            [style.--arm-ms]="armMs + 'ms'"
            (click)="discard()"
          >
            {{ discardArmed() ? 'Noch einmal tippen zum Verwerfen' : 'Fahrt verwerfen' }}
          </button>
          <p class="hint">
            Löscht die Aufnahme von diesem Gerät. Das lässt sich nicht rückgängig machen.
          </p>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }

    /* Die eigene Strecke als Piktogramm: ein weißer Strich wie auf einem Wegweiser.
       Ring = Start, Punkt = Ziel (dieselbe Formsprache wie .sense). Bei einer Runde liegen
       beide aufeinander und ergeben eine Zielscheibe. */
    .route {
      display: block;
      width: 100%;
      max-width: 560px;
      height: auto;
      margin: -4px auto 0;
    }
    .route .line {
      fill: none;
      stroke: var(--fg);
      stroke-width: 11;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-dasharray: 1;
      stroke-dashoffset: 1;
      animation: draw 1.4s cubic-bezier(0.45, 0, 0.2, 1) 0.1s forwards;
    }
    .route .start {
      fill: var(--bg);
      stroke: var(--fg);
      stroke-width: 7;
    }
    .route .end {
      fill: var(--fg);
      opacity: 0;
      animation: arrive 0.25s ease-out 1.45s forwards;
    }
    @keyframes draw {
      to {
        stroke-dashoffset: 0;
      }
    }
    @keyframes arrive {
      to {
        opacity: 1;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .route .line {
        animation: none;
        stroke-dashoffset: 0;
      }
      .route .end {
        animation: none;
        opacity: 1;
      }
    }

    .facts {
      margin: 0;
      display: grid;
      grid-template-columns: 1.3fr 1fr 1fr;
      border-top: 2px solid var(--fg);
      border-bottom: 1px solid var(--line);
    }
    .facts > div {
      padding: 8px 10px 10px;
      min-width: 0;
    }
    .facts > div + div {
      border-left: 1px solid var(--line);
    }
    .facts > div:first-child {
      padding-left: 0;
    }
    .facts dt {
      font-family: var(--digits);
      font-size: var(--t-m);
      font-weight: 700;
      color: var(--muted);
      display: flex;
      justify-content: space-between;
    }
    .facts dt span {
      font-weight: 400;
    }
    .facts dd {
      margin: 4px 0 0;
      font-size: var(--t-2xl);
      line-height: 1;
      white-space: nowrap;
    }
    .extra {
      margin-top: 8px;
      font-family: var(--digits);
      font-size: var(--t-m);
      font-weight: 700;
      color: var(--muted);
    }
    .empty {
      padding: 4px 0 8px;
    }

    .strava {
      margin-top: 24px;
    }
    /* Während des Sendens bleibt der Knopf lesbar statt grau: Es passiert gerade etwas. */
    .btn.send.busy:disabled {
      opacity: 1;
      background: transparent;
      color: var(--fg);
      border-style: dashed;
    }

    .problem {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      padding: 12px 0 4px;
    }
    .problem .sense {
      margin-top: 5px;
    }
    .problem-title {
      font-family: var(--digits);
      font-size: var(--t-l);
      font-weight: 700;
      color: var(--warn);
      margin-bottom: 4px;
    }

    .saved {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 32px;
      font-family: var(--digits);
      font-size: var(--t-l);
      font-weight: 700;
    }

    /* Abgesetzt, damit niemand beim Export daneben tippt. */
    .discard {
      margin-top: 44px;
      padding-top: 20px;
      border-top: 1px solid var(--line);
      display: grid;
      gap: 10px;
    }
    .btn.danger {
      position: relative;
      overflow: hidden;
    }
    .btn.danger.armed {
      background: var(--warn);
      color: var(--bg);
    }
    /* Der Balken läuft leer, solange die zweite Berührung zählt. */
    .btn.danger.armed::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 5px;
      background: var(--bg);
      opacity: 0.55;
      transform-origin: left;
      animation: disarm var(--arm-ms) linear forwards;
    }
    @keyframes disarm {
      from {
        transform: scaleX(1);
      }
      to {
        transform: scaleX(0);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .btn.danger.armed::after {
        display: none;
      }
    }
  `,
})
export class SavePage {
  protected readonly ride = inject(RideRecorder);
  protected readonly sync = inject(RideSync);
  protected readonly strava = inject(Strava);
  private readonly toasts = inject(Toasts);
  private readonly router = inject(Router);

  protected readonly viewBox = `0 0 ${SHAPE_W} ${SHAPE_H}`;
  protected readonly armMs = DISCARD_ARM_MS;
  protected readonly exported = signal(false);
  protected readonly uploadError = signal<string | null>(null);
  protected readonly discardArmed = signal(false);
  private discardTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly uploadModel = signal({ name: '', commute: false });
  protected readonly uploadForm = form(this.uploadModel);

  /** Hängt an `trackLength`, weil der Track selbst bewusst kein Signal ist. */
  protected readonly route = computed(() => {
    this.ride.trackLength();
    return routeShape(this.ride.snapshot().track);
  });

  protected readonly suggestedName = computed(() => defaultRideName(this.ride.stats().startedAt));

  protected readonly facts = computed(() => {
    const stats = this.ride.stats();
    const laps = this.ride.laps().length;
    const extra: string[] = [];
    if (laps > 1) extra.push(`${laps} Runden`);
    if (stats.pwrN > 0) extra.push(`Ø ${Math.round(stats.pwrSum / stats.pwrN)} W`);
    return {
      time: fmtTime(stats.movingMs),
      km: num(stats.distanceM / 1000, 2),
      ascent: num(stats.ascentM, 0),
      extra: extra.join(', '),
    };
  });

  protected readonly sendLabel = computed(() => {
    switch (this.sync.phase()) {
      case 'sending':
        return 'Sendet …';
      case 'processing':
        return 'Strava verarbeitet …';
      default:
        return 'Zu Strava senden';
    }
  });

  protected async exportFile(): Promise<void> {
    const result = await this.sync.share();
    if (result === 'empty') this.toasts.show('Noch nichts aufgezeichnet.');
    if (result === 'downloaded') this.toasts.show('Fahrt als TCX-Datei gespeichert.');
    // Nach einem Export nicht sofort beenden: Wer will, lädt dieselbe Fahrt noch zu Strava.
    if (result === 'downloaded' || result === 'shared') this.exported.set(true);
  }

  /** Ist die Fahrt auf Strava, ist sie abgeschlossen: zurücksetzen, zurück zur Fahrtseite. */
  protected async upload(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.ride.hasData() || this.sync.uploading()) return;
    const { name, commute } = this.uploadModel();
    this.uploadError.set(null);
    try {
      this.finish(await this.sync.upload(name.trim() || this.suggestedName(), commute));
    } catch (err) {
      this.uploadError.set(err instanceof Error ? err.message : 'Upload fehlgeschlagen.');
    }
  }

  protected finish(message: string): void {
    this.ride.reset();
    this.exported.set(false);
    this.uploadError.set(null);
    this.uploadModel.set({ name: '', commute: false });
    this.toasts.show(message, 6000);
    void this.router.navigateByUrl(RC.ride);
  }

  /** Zweistufig statt Rückfrage-Dialog: Der fehlt in manchen eingebetteten Browsern. */
  protected discard(): void {
    if (!this.discardArmed()) {
      this.discardArmed.set(true);
      this.discardTimer = setTimeout(() => this.discardArmed.set(false), DISCARD_ARM_MS);
      return;
    }
    if (this.discardTimer) clearTimeout(this.discardTimer);
    this.discardArmed.set(false);
    this.exported.set(false);
    this.uploadError.set(null);
    this.ride.reset();
    this.toasts.show('Fahrt verworfen.');
  }
}
