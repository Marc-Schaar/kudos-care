import { inject, Injectable, signal } from '@angular/core';
import { Bike } from '../../../../shared/services/strava-service/strava-service';
import { tap } from 'rxjs';
import { environment } from './../../../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import {
  BikeComponent,
  BikeDetail,
  BikeList,
  ComponentSlotDetail,
  ComponentTemplate,
  CreateComponentPayload,
} from '../../models/maintenance.models';

@Injectable({
  providedIn: 'root',
})
export class BikeService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  public bikes = signal<BikeList[]>([]);
  public selectedBike = signal<BikeDetail | null>(null);
  public selectedSlot = signal<ComponentSlotDetail | null>(null);
  public templates = signal<ComponentTemplate[]>([]);

  fetchBikes() {
    return this.http
      .get<BikeList[]>(`${this.baseUrl}/maintenance/bikes/`)
      .pipe(tap((res) => this.bikes.set(res)));
  }

  fetchBikeDetails(bikeId: number) {
    return this.http
      .get<BikeDetail>(`${this.baseUrl}/maintenance/bikes/${bikeId}/`)
      .pipe(tap((res) => this.selectedBike.set(res)));
  }

  updateBike(
    bikeId: number,
    payload: Partial<{ name: string; bike_type: string; retired: boolean }>,
  ) {
    return this.http
      .patch<BikeDetail>(`${this.baseUrl}/maintenance/bikes/${bikeId}/`, payload)
      .pipe(tap((res) => this.selectedBike.set(res)));
  }

  fetchSlotDetail(slotId: number) {
    return this.http
      .get<ComponentSlotDetail>(`${this.baseUrl}/maintenance/slots/${slotId}/`)
      .pipe(tap((res) => this.selectedSlot.set(res)));
  }
  addComponent(slotId: number, payload: CreateComponentPayload) {
    return this.http.post<BikeComponent>(
      `${this.baseUrl}/maintenance/slots/${slotId}/components/`,
      payload,
    );
  }

  updateComponent(componentId: number, payload: Partial<BikeComponent>) {
    return this.http.patch<BikeComponent>(
      `${this.baseUrl}/maintenance/components/${componentId}/`,
      payload,
    );
  }

  deleteComponent(componentId: number) {
    return this.http.delete(`${this.baseUrl}/maintenance/components/${componentId}/`);
  }

  mountComponent(slotId: number, componentId: number) {
    return this.http.post<BikeComponent>(`${this.baseUrl}/maintenance/slots/${slotId}/mount/`, {
      component_id: componentId,
    });
  }

  unmountComponent(slotId: number) {
    return this.http.post<BikeComponent>(
      `${this.baseUrl}/maintenance/slots/${slotId}/unmount/`,
      {},
    );
  }

  // ── Templates ──────────────────────────────────────────────────────────────

  fetchTemplates(bikeType?: string) {
    const params = bikeType ? `?bike_type=${bikeType}` : '';
    return this.http
      .get<ComponentTemplate[]>(`${this.baseUrl}/maintenance/templates/${params}`)
      .pipe(tap((res) => this.templates.set(res)));
  }

  // ── Slot zu Bike hinzufügen ─────────────────────────────────────────────────

  addSlot(bikeId: number, templateId: number, customName = '') {
    return this.http.post(`${this.baseUrl}/maintenance/bikes/${bikeId}/slots/`, {
      template: templateId,
      custom_name: customName,
    });
  }
}
