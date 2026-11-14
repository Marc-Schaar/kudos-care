import { Injectable, inject, signal } from '@angular/core';

import { RideRecorder } from './ride-recorder';
import { Strava } from './strava';
import { buildTcx, tcxFileName } from './tcx';

const POLL_TRIES = 8;
const POLL_MS = 2000;

export type ShareResult = 'shared' | 'downloaded' | 'cancelled' | 'empty';

/**
 * Export und Upload der Fahrt.
 *
 * Strava verlangt für den Token-Tausch ein Client-Secret, das nicht in den Browser
 * gehört. Der Upload geht deshalb an das eigene Backend, das die Datei an Strava
 * weiterreicht (siehe backend/README.md).
 */
@Injectable({ providedIn: 'root' })
export class RideSync {
  private readonly ride = inject(RideRecorder);
  private readonly strava = inject(Strava);

  readonly uploading = signal(false);

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
   * Schickt die Fahrt über das Backend zu Strava und wartet kurz, bis Strava sie
   * verarbeitet hat. Liefert eine Meldung für die Anzeige oder wirft mit Klartext.
   */
  async upload(name: string, commute: boolean): Promise<string> {
    const file = this.buildFile();
    if (!file) throw new Error('Noch nichts aufgezeichnet.');

    const form = new FormData();
    form.append('file', file, file.name);
    form.append('data_type', 'tcx');
    form.append('external_id', file.name);
    form.append('name', name.trim() || 'Radfahrt');
    form.append('commute', commute ? '1' : '0');

    this.uploading.set(true);
    try {
      let state = await this.strava.upload(form);
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
      return state.activity_id
        ? 'Fahrt ist auf Strava.'
        : 'Fahrt hochgeladen. Strava verarbeitet sie noch.';
    } finally {
      this.uploading.set(false);
    }
  }
}
