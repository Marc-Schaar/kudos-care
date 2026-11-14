import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../../../core/interceptors/error-interceptor/error-interceptor';
import { Place } from '../core/models';
import { store } from '../core/storage';

/** Früherer Speicherort im Browser; wird beim ersten Laden ins Konto übernommen und gelöscht. */
const LEGACY_KEY = 'radcomputer.places.v1';

type StoredPlace = Place & { id: number };

/**
 * Feste Ziele wie „Zuhause“ oder „Arbeit“. Sie liegen im Kudos-Konto, dort verschlüsselt
 * (GET|POST /api/radcomputer/places/), und bewusst nicht mehr im Klartext im Browser:
 * „Zuhause“ ist die Wohnadresse.
 */
@Injectable({ providedIn: 'root' })
export class SavedPlaces {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/radcomputer/places/`;
  private readonly context = new HttpContext().set(SKIP_ERROR_TOAST, true);

  readonly list = signal<Place[]>([]);
  /** Ohne Verbindung beim Laden: die Liste ist dann leer, aber nicht wirklich leer. */
  readonly unavailable = signal(false);

  constructor() {
    void this.load();
  }

  /** Speichert im Konto; ein Ort gleichen Namens wird ersetzt. */
  async add(place: Place): Promise<boolean> {
    try {
      const saved = await this.post(place);
      this.list.update((list) => [...list.filter((p) => p.name !== saved.name), saved]);
      return true;
    } catch {
      return false;
    }
  }

  async remove(place: Place): Promise<boolean> {
    const id = (place as Partial<StoredPlace>).id;
    try {
      if (id != null) {
        await firstValueFrom(this.http.delete(`${this.url}${id}/`, { context: this.context }));
      }
      this.list.update((list) => list.filter((p) => p !== place));
      return true;
    } catch {
      return false;
    }
  }

  private async load(): Promise<void> {
    try {
      let places = await firstValueFrom(
        this.http.get<StoredPlace[]>(this.url, { context: this.context }),
      );
      const legacy = store.get<Place[]>(LEGACY_KEY);
      if (legacy?.length) {
        const known = new Set(places.map((p) => p.name));
        for (const place of legacy.filter((p) => !known.has(p.name))) {
          places = [...places, await this.post(place)];
        }
      }
      store.del(LEGACY_KEY);
      this.list.set(places);
      this.unavailable.set(false);
    } catch {
      // Lokale Altdaten bleiben stehen, bis die Übernahme einmal geklappt hat.
      this.list.set(store.get<Place[]>(LEGACY_KEY) ?? []);
      this.unavailable.set(true);
    }
  }

  private post(place: Place): Promise<StoredPlace> {
    return firstValueFrom(
      this.http.post<StoredPlace>(
        this.url,
        { name: place.name, lat: place.lat, lon: place.lon },
        { context: this.context },
      ),
    );
  }
}
