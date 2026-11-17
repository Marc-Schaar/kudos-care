import { Injectable, inject, signal } from '@angular/core';

import { RideRecorder } from './ride-recorder';
import { ActivityTags, RideSportType, Strava } from './strava';
import { buildTcx, tcxFileName } from './tcx';

/** Strava braucht meist Sekunden, selten eine Minute: so lange wartet der Knopf. */
const POLL_TRIES = 30;
const POLL_MS = 2000;

export type ShareResult = 'shared' | 'downloaded' | 'cancelled' | 'empty';

/** Was beim Hochladen mitgeht. */
export interface UploadMeta {
  name: string;
  description: string;
  commute: boolean;
  trainer: boolean;
  tags: ActivityTags;
}

/**
 * Eingaben auf der Speichern-Seite. Liegt hier statt in der Seite, damit Titel und Tags
 * stehen bleiben, wenn man zwischendurch zur Fahrt zurückwischt.
 */
export interface UploadDraft {
  name: string;
  description: string;
  commute: boolean;
  trainer: boolean;
  hideFromHome: boolean;
  sportType: RideSportType;
  /** Selbst gewählt: dann überschreibt die Radwahl den Typ nicht mehr. */
  sportTypeChosen: boolean;
  /** Strava-Rad-Id, leer = Standardrad bei Strava */
  gearId: string;
}

export const emptyDraft = (gearId = ''): UploadDraft => ({
  name: '',
  description: '',
  commute: false,
  trainer: false,
  hideFromHome: false,
  sportType: 'Ride',
  sportTypeChosen: false,
  gearId,
});

export interface UploadOutcome {
  /** Gesetzt, sobald Strava die Fahrt verarbeitet hat */
  activityId: number | null;
  message: string;
  /** Hinweis, wenn Radtyp, Rad oder Feed nicht gesetzt werden konnten */
  tagsProblem: string | null;
}

/**
 * Export und Upload der Fahrt.
 *
 * Strava verlangt für den Token-Tausch ein Client-Secret, das nicht in den Browser
 * gehört. Der Upload geht deshalb an das eigene Backend, das die Datei an Strava
 * weiterreicht (`app_radcomputer` im Backend).
 */
@Injectable({ providedIn: 'root' })
export class RideSync {
  private readonly ride = inject(RideRecorder);
  private readonly strava = inject(Strava);

  readonly uploading = signal(false);
  /** Für die Anzeige am Knopf: erst geht die Datei raus, dann wartet Strava aufs Verarbeiten. */
  readonly phase = signal<'idle' | 'sending' | 'processing' | 'tagging'>('idle');
  readonly draft = signal<UploadDraft>(emptyDraft());

  private buildFile(): File | null {
    const { track, laps, stats } = this.ride.snapshot();
    const xml = buildTcx(track, laps, stats);
    return xml ? new File([xml], tcxFileName(track[0][0]), { type: 'application/xml' }) : null;
  }

  /** Öffnet das Teilen-Menü (iOS: „In Dateien sichern“), sonst lädt der Browser die Datei herunter. */
  async share(): Promise<ShareResult> {
    const file = this.buildFile();
    if (!file) return 'empty';
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: file.name });
        return 'shared';
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return 'cancelled';
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return 'downloaded';
  }

  /**
   * Schickt die Fahrt über das Backend zu Strava, wartet, bis Strava sie verarbeitet hat,
   * und trägt dann nach, was der Upload nicht kennt. Wirft mit Klartext, wenn die Fahrt
   * nicht auf Strava ist; ein Problem nur mit den Tags meldet `tagsProblem`.
   */
  async upload(meta: UploadMeta): Promise<UploadOutcome> {
    const file = this.buildFile();
    if (!file) throw new Error('Noch nichts aufgezeichnet.');

    const form = new FormData();
    form.append('file', file, file.name);
    form.append('data_type', 'tcx');
    form.append('external_id', file.name);
    form.append('name', meta.name.trim() || 'Radfahrt');
    form.append('description', meta.description.trim());
    form.append('commute', meta.commute ? '1' : '0');
    form.append('trainer', meta.trainer ? '1' : '0');

    this.uploading.set(true);
    this.phase.set('sending');
    try {
      let state = await this.strava.upload(form);
      this.phase.set('processing');
      // Strava verarbeitet im Hintergrund, meist in wenigen Sekunden.
      for (
        let i = 0;
        i < POLL_TRIES && state.id != null && !state.error && !state.activity_id;
        i++
      ) {
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
        state = await this.strava.uploadStatus(state.id);
      }
      if (state.error)
        throw new Error(
          /duplicate/i.test(state.error)
            ? 'Diese Fahrt ist schon auf Strava.'
            : `Strava: ${state.error}`,
        );
      if (!state.activity_id) {
        return {
          activityId: null,
          message: 'Fahrt hochgeladen. Strava verarbeitet sie noch.',
          tagsProblem: Object.keys(meta.tags).length
            ? 'Radtyp und Rad bitte bei Strava nachtragen: die Fahrt war noch nicht fertig.'
            : null,
        };
      }
      this.phase.set('tagging');
      let tagsProblem: string | null = null;
      try {
        await this.strava.complete(state.activity_id, meta.tags);
      } catch (err) {
        tagsProblem = `Radtyp und Rad nicht gesetzt: ${err instanceof Error ? err.message : 'Fehler'}`;
      }
      return { activityId: state.activity_id, message: 'Fahrt ist auf Strava.', tagsProblem };
    } finally {
      this.uploading.set(false);
      this.phase.set('idle');
    }
  }
}
