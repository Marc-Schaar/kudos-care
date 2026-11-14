import { Component, computed, inject, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';

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
      <rc-sub-header title="Fahrt speichern" />
      <div class="stack">
        <p class="hint">{{ ride.hasData() ? summary() : 'Noch nichts aufgezeichnet.' }}</p>

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
              {{ sync.uploading() ? 'Lädt hoch …' : 'Zu Strava hochladen' }}
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
  `,
})
export class SavePage {
  protected readonly ride = inject(RideRecorder);
  protected readonly sync = inject(RideSync);
  protected readonly strava = inject(Strava);
  private readonly toasts = inject(Toasts);
  private discardTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly uploadModel = signal({ name: '', commute: false });
  protected readonly uploadForm = form(this.uploadModel);
  protected readonly discardArmed = signal(false);

  protected readonly summary = computed(() => {
    const stats = this.ride.stats();
    return `${fmtTime(stats.movingMs)} Fahrzeit, ${num(stats.distanceM / 1000, 2)} km, ${this.ride.laps().length} Runden`;
  });

  protected async exportFile(): Promise<void> {
    const result = await this.sync.share();
    if (result === 'empty') this.toasts.show('Noch nichts aufgezeichnet.');
    if (result === 'downloaded') this.toasts.show('Fahrt als TCX-Datei gespeichert.');
  }

  protected async upload(event: Event): Promise<void> {
    event.preventDefault();
    const { name, commute } = this.uploadModel();
    try {
      this.toasts.show(await this.sync.upload(name, commute), 6000);
    } catch (err) {
      this.toasts.show(err instanceof Error ? err.message : 'Upload fehlgeschlagen.', 6000);
    }
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
