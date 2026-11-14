import { Component, computed, inject, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { Router } from '@angular/router';

import { fmtTime, num } from '../core/format';
import { RideRecorder } from '../core/ride-recorder';
import { RideSync } from '../core/ride-sync';
import { Strava } from '../core/strava';
import { Toasts } from '../core/toasts';
import { SubHeader } from './sub-header';
import { RC } from '../core/paths';

/** Fahrt exportieren, zu Strava hochladen oder verwerfen. */
@Component({
  selector: 'rc-save-page',
  imports: [FormField, SubHeader],
  template: `
    <div class="scroll">
      <rc-sub-header [title]="ride.status() === 'idle' ? 'Fahrt speichern' : 'Fahrt abschließen'" />
      <div class="stack">
        @if (exported() && ride.status() !== 'idle') {
          <div class="done">
            <p>Die TCX-Datei ist gesichert. Schließ die Fahrt ab, um eine neue zu starten.</p>
            <button type="button" class="btn primary" (click)="finish('Fahrt abgeschlossen.')">
              Fahrt abschließen
            </button>
          </div>
        }
        @if (ride.hasData()) {
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
              <dt>Runden</dt>
              <dd class="digits">{{ facts().laps }}</dd>
            </div>
          </dl>
        } @else {
          <p class="hint">Noch nichts aufgezeichnet. Starte die Aufnahme auf der Fahrtseite.</p>
        }

        <form class="stack" (submit)="upload($event)">
          <div class="form-row">
            <label for="up-name">Titel für Strava</label>
            <input
              id="up-name"
              type="text"
              [formField]="uploadForm.name"
              placeholder="Radfahrt"
              autocomplete="off"
            />
          </div>
          <label class="check-row">
            Als Pendelfahrt markieren
            <input type="checkbox" [formField]="uploadForm.commute" />
          </label>
          @if (strava.canUpload()) {
            <button
              type="submit"
              class="btn primary"
              [disabled]="!ride.hasData() || sync.uploading()"
            >
              {{ sync.uploading() ? 'Lädt hoch …' : 'Abschließen und zu Strava senden' }}
            </button>
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
              Einmalig nötig: Strava fragt, ob Kudos Care Aktivitäten hochladen darf.
            </p>
          }
        </form>

        <h3 class="section-title">Andere Wege</h3>
        <button type="button" class="btn" (click)="exportFile()" [disabled]="!ride.hasData()">
          Als TCX-Datei exportieren
        </button>
        <p class="hint">
          Garmin Connect nimmt Fahrten von fremden Apps nicht direkt an. Exportiere die TCX-Datei
          und lade sie in Garmin Connect im Browser über „Importieren“ hoch.
        </p>

        <button
          type="button"
          class="btn danger"
          (click)="discard()"
          [disabled]="ride.status() === 'idle'"
        >
          {{ discardArmed() ? 'Wirklich verwerfen? Noch einmal tippen' : 'Fahrt verwerfen' }}
        </button>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .facts {
      margin: 0 0 8px;
      display: grid;
      grid-template-columns: 1.3fr 1fr 0.8fr;
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
    .btn.danger {
      margin-top: 18px;
    }
    .done {
      padding: 12px 0 14px;
      border-bottom: 1px solid var(--line);
    }
    .done p {
      margin: 0 0 10px;
    }
  `,
})
export class SavePage {
  protected readonly ride = inject(RideRecorder);
  protected readonly sync = inject(RideSync);
  protected readonly strava = inject(Strava);
  private readonly toasts = inject(Toasts);
  private readonly router = inject(Router);
  protected readonly exported = signal(false);
  private discardTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly uploadModel = signal({ name: '', commute: false });
  protected readonly uploadForm = form(this.uploadModel);
  protected readonly discardArmed = signal(false);

  protected readonly facts = computed(() => {
    const stats = this.ride.stats();
    return {
      time: fmtTime(stats.movingMs),
      km: num(stats.distanceM / 1000, 2),
      laps: String(this.ride.laps().length),
    };
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
    const { name, commute } = this.uploadModel();
    try {
      this.finish(await this.sync.upload(name, commute));
    } catch (err) {
      this.toasts.show(err instanceof Error ? err.message : 'Upload fehlgeschlagen.', 6000);
    }
  }

  protected finish(message: string): void {
    this.ride.reset();
    this.exported.set(false);
    this.uploadModel.set({ name: '', commute: false });
    this.toasts.show(message, 6000);
    void this.router.navigateByUrl(RC.ride);
  }

  /** Zweistufig statt Rückfrage-Dialog: Der fehlt in manchen eingebetteten Browsern. */
  protected discard(): void {
    if (!this.discardArmed()) {
      this.discardArmed.set(true);
      this.discardTimer = setTimeout(() => this.discardArmed.set(false), 4000);
      return;
    }
    if (this.discardTimer) clearTimeout(this.discardTimer);
    this.discardArmed.set(false);
    this.ride.reset();
    this.toasts.show('Fahrt verworfen.');
  }
}
