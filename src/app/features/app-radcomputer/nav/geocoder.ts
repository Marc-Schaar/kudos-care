import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { Place } from '../core/models';

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    country?: string;
  };
}
interface PhotonResponse {
  features?: PhotonFeature[];
}

/** Adress- und Ortssuche über Photon (OpenStreetMap-Daten, ohne Schlüssel). */
@Injectable({ providedIn: 'root' })
export class Geocoder {
  private readonly http = inject(HttpClient);

  async search(query: string, near: { lat: number; lon: number } | null): Promise<Place[]> {
    const params: Record<string, string> = { q: query, limit: '6', lang: 'de' };
    if (near) {
      params['lat'] = near.lat.toFixed(4);
      params['lon'] = near.lon.toFixed(4);
    }
    const res = await firstValueFrom(
      this.http.get<PhotonResponse>('https://photon.komoot.io/api/', { params }),
    );
    return (res.features ?? []).map((f) => {
      const p = f.properties;
      const street = [p.street, p.housenumber].filter(Boolean).join(' ');
      const town = [p.postcode, p.city].filter(Boolean).join(' ');
      const parts = [p.name, street, town || p.country].filter((part): part is string => !!part);
      return {
        name: parts.join(', ') || query,
        lat: f.geometry.coordinates[1],
        lon: f.geometry.coordinates[0],
      };
    });
  }
}
