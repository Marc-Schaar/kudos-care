import { inject, Injectable, signal } from '@angular/core';
import { map, Observable, of, tap } from 'rxjs';
import { environment } from './../../../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import {
  AssembliesResponse,
  BikeAssembly,
  BikeComponent,
  BikeDetail,
  BikeList,
  CheckInstructions,
  ComponentCheckPayload,
  ComponentGroupCatalog,
  ComponentSlotDetail,
  ComponentSlotList,
  ComponentTemplate,
  CreateAssemblyPayload,
  CreateComponentPayload,
  CreateIntervalPayload,
  IntervalLogPayload,
  MaintenanceInterval,
  WeatherWearExplanation,
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

  private devMode = false;

  private mokedBikes: BikeList[] = [
    {
      id: 1,
      strava_bike_id: 101,
      name: 'Trek Emonda',
      bike_type: 'road',
      bike_type_display: 'Rennrad',
      retired: false,
      total_distance_km: 12500,
      warn_status: 'ok',
    },
    {
      id: 2,
      strava_bike_id: 102,
      name: 'Altes Stahl-RR',
      bike_type: 'road',
      bike_type_display: 'Rennrad',
      retired: true,
      total_distance_km: 45000,
      warn_status: 'unknown',
    },

    // --- Mountainbike Kategorie ---
    {
      id: 3,
      strava_bike_id: 201,
      name: 'Specialized Stumpjumper',
      bike_type: 'mtb',
      bike_type_display: 'Mountainbike',
      retired: false,
      total_distance_km: 3200,
      warn_status: 'warn',
    },
    {
      id: 4,
      strava_bike_id: 202,
      name: 'Downhill Schlitten',
      bike_type: 'mtb',
      bike_type_display: 'Mountainbike',
      retired: false,
      total_distance_km: 800,
      warn_status: 'critical',
    },

    // --- Gravel & CX ---
    {
      id: 5,
      strava_bike_id: 301,
      name: 'Canyon Grail',
      bike_type: 'gravel',
      bike_type_display: 'Gravel',
      retired: false,
      total_distance_km: 8900,
      warn_status: 'ok',
    },
    {
      id: 6,
      strava_bike_id: 302,
      name: 'Crosser Training',
      bike_type: 'cx',
      bike_type_display: 'Cyclocross',
      retired: false,
      total_distance_km: 2100,
      warn_status: 'warn',
    },

    // --- E-Bikes ---
    {
      id: 7,
      strava_bike_id: 401,
      name: 'Turbo Levo SL',
      bike_type: 'ebike_mtb',
      bike_type_display: 'E-MTB',
      retired: false,
      total_distance_km: 4500,
      warn_status: 'ok',
    },
    {
      id: 8,
      strava_bike_id: 402,
      name: 'Commuter E-Bike',
      bike_type: 'ebike_city',
      bike_type_display: 'E-Stadtrad',
      retired: false,
      total_distance_km: 12000,
      warn_status: 'critical',
    },
    {
      id: 9,
      strava_bike_id: 403,
      name: 'E-Road Pro',
      bike_type: 'ebike_road',
      bike_type_display: 'E-Rennrad',
      retired: false,
      total_distance_km: 1500,
      warn_status: 'ok',
    },

    // --- City & Sonstiges ---
    {
      id: 10,
      strava_bike_id: 501,
      name: 'Bahnhofsrad',
      bike_type: 'city',
      bike_type_display: 'Stadtrad',
      retired: false,
      total_distance_km: 500,
      warn_status: 'ok',
    },
    {
      id: 11,
      strava_bike_id: 502,
      name: 'Einrad / Lastenrad',
      bike_type: 'other',
      bike_type_display: 'Sonstiges',
      retired: false,
      total_distance_km: 150,
      warn_status: 'unknown',
    },
  ];

  public fetchBikes(): Observable<BikeList[]> {
    if (this.devMode) {
      this.bikes.set(this.mokedBikes);
      return of(this.mokedBikes);
    } else {
      return this.http.get<{ bikes: BikeList[] }>(`${this.baseUrl}/maintenance/bikes/`).pipe(
        map((response) => response.bikes),
        tap((res) => this.bikes.set(res)),
      );
    }
  }

  fetchBikeDetails(bikeId: number) {
    if (this.devMode) {
      const bike = this.mokedBikes.find((b) => b.id === bikeId) || null;
      const details: BikeDetail = {
        ...bike!,
        slots: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.selectedBike.set(details);
      return of(details);
    } else {
      return this.http
        .get<BikeDetail>(`${this.baseUrl}/maintenance/bikes/${bikeId}/`)
        .pipe(tap((res) => this.selectedBike.set(res)));
    }
  }

  fetchDistanceAtDate(bikeId: number, isoDate: string) {
    return this.http.get<{ distance_km: number }>(
      `${this.baseUrl}/maintenance/bikes/${bikeId}/distance-at/`,
      { params: { date: isoDate } },
    );
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

  fetchComponent(componentId: number) {
    return this.http.get<BikeComponent>(`${this.baseUrl}/maintenance/components/${componentId}/`);
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

  checkComponent(componentId: number, payload: ComponentCheckPayload) {
    return this.http.post<BikeComponent>(
      `${this.baseUrl}/maintenance/components/${componentId}/check/`,
      payload,
    );
  }

  fetchWeatherExplanation(componentId: number, refresh = false) {
    const params = refresh ? '?refresh=true' : '';
    return this.http.get<WeatherWearExplanation>(
      `${this.baseUrl}/maintenance/components/${componentId}/weather-explanation/${params}`,
    );
  }

  fetchCheckInstructions(componentId: number, refresh = false) {
    const params = refresh ? '?refresh=true' : '';
    return this.http.get<CheckInstructions>(
      `${this.baseUrl}/maintenance/components/${componentId}/check-instructions/${params}`,
    );
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

  // ── Baugruppen-Katalog + Bike-Baugruppen ───────────────────────────────────

  fetchGroups(bikeType?: string) {
    const params = bikeType ? `?bike_type=${bikeType}` : '';
    return this.http.get<ComponentGroupCatalog[]>(
      `${this.baseUrl}/maintenance/groups/${params}`,
    );
  }

  fetchAssemblies(bikeId: number) {
    return this.http.get<AssembliesResponse>(
      `${this.baseUrl}/maintenance/bikes/${bikeId}/assemblies/`,
    );
  }

  createAssembly(bikeId: number, payload: CreateAssemblyPayload) {
    return this.http.post<BikeAssembly>(
      `${this.baseUrl}/maintenance/bikes/${bikeId}/assemblies/`,
      payload,
    );
  }

  updateAssembly(assemblyId: number, patch: Partial<Pick<BikeAssembly, 'name' | 'installed_at' | 'is_active' | 'retired_at'>>) {
    return this.http.patch<BikeAssembly>(
      `${this.baseUrl}/maintenance/assemblies/${assemblyId}/`,
      patch,
    );
  }

  deleteAssembly(assemblyId: number) {
    return this.http.delete(`${this.baseUrl}/maintenance/assemblies/${assemblyId}/`);
  }

  swapAssembly(assemblyId: number, payload: CreateAssemblyPayload) {
    return this.http.post<BikeAssembly>(
      `${this.baseUrl}/maintenance/assemblies/${assemblyId}/swap/`,
      payload,
    );
  }

  // ── Wartungs-Intervalle (Verbrauchsmaterial / Pflege) ──────────────────────

  addInterval(bikeId: number, payload: CreateIntervalPayload) {
    return this.http.post<MaintenanceInterval>(
      `${this.baseUrl}/maintenance/bikes/${bikeId}/intervals/`,
      payload,
    );
  }

  updateInterval(intervalId: number, patch: Partial<MaintenanceInterval>) {
    return this.http.patch<MaintenanceInterval>(
      `${this.baseUrl}/maintenance/intervals/${intervalId}/`,
      patch,
    );
  }

  deleteInterval(intervalId: number) {
    return this.http.delete(`${this.baseUrl}/maintenance/intervals/${intervalId}/`);
  }

  logInterval(intervalId: number, payload: IntervalLogPayload = {}) {
    return this.http.post<MaintenanceInterval>(
      `${this.baseUrl}/maintenance/intervals/${intervalId}/log/`,
      payload,
    );
  }
}
