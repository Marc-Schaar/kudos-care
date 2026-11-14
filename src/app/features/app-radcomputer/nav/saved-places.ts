import { Injectable, effect, signal } from '@angular/core';

import { Place } from '../core/models';
import { store } from '../core/storage';

const KEY = 'radcomputer.places.v1';

/** Feste Ziele wie „Zuhause“ oder „Arbeit“. */
@Injectable({ providedIn: 'root' })
export class SavedPlaces {
  readonly list = signal<Place[]>(store.get<Place[]>(KEY) ?? []);

  constructor() {
    effect(() => store.set(KEY, this.list()));
  }

  add(place: Place): void {
    this.list.update((list) => [...list.filter((p) => p.name !== place.name), place]);
  }

  remove(place: Place): void {
    this.list.update((list) => list.filter((p) => p !== place));
  }
}
