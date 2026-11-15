import { inject, Injectable, signal } from '@angular/core';
import { map, Observable, tap } from 'rxjs';
import { environment } from './../../../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import {
  ActivationPlan,
  AddAssemblyItemPayload,
  AssembliesResponse,
  BikeAssembly,
  BikeComponent,
  BikeConditionReport,
  BikeDetail,
  BikeList,
  BulkInstalledAtResult,
  CheckInstructions,
  ComponentCheckPayload,
  ComponentGroupCatalog,
  ComponentSlot,
  ComponentTemplate,
  CreateAssemblyPayload,
  CreateComponentPayload,
  CreateIntervalPayload,
  CreateTemplatePayload,
  IntervalLogPayload,
  KudoModelCandidate,
  KudoSetupSuggestion,
  MaintenanceInterval,
  NextRideForecast,
  UpdateComponentPayload,
  WeatherWearExplanation,
} from '../../models/maintenance.models';

/** Optional: an welchem Tag etwas passiert ist. Ohne Angabe gilt "jetzt". */
function dayBody(on?: string | null): { on?: string } {
  return on ? { on } : {};
}

@Injectable({
  providedIn: 'root',
})
export class BikeService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/maintenance`;

  public bikes = signal<BikeList[]>([]);
  public selectedBike = signal<BikeDetail | null>(null);

  // ── Räder ──────────────────────────────────────────────────────────────────

  fetchBikes(): Observable<BikeList[]> {
    return this.http.get<{ bikes: BikeList[] }>(`${this.baseUrl}/bikes/`).pipe(
      map((response) => response.bikes),
      tap((res) => this.bikes.set(res)),
    );
  }

  fetchBikeDetails(bikeId: number) {
    return this.http
      .get<BikeDetail>(`${this.baseUrl}/bikes/${bikeId}/`)
      .pipe(tap((res) => this.selectedBike.set(res)));
  }

  createBike(payload: { name: string; bike_type: string }) {
    return this.http.post<BikeDetail>(`${this.baseUrl}/bikes/`, payload);
  }

  updateBike(
    bikeId: number,
    payload: Partial<{ name: string; bike_type: string; retired: boolean }>,
  ) {
    return this.http
      .patch<BikeDetail>(`${this.baseUrl}/bikes/${bikeId}/`, payload)
      .pipe(tap((res) => this.selectedBike.set(res)));
  }

  deleteBike(bikeId: number) {
    return this.http
      .delete(`${this.baseUrl}/bikes/${bikeId}/`)
      .pipe(tap(() => this.selectedBike.set(null)));
  }

  /**
   * KI-Zustandsbericht ueber alle montierten Komponenten eines Bikes.
   * Serverseitig gecacht; `refresh` erzwingt eine Neugenerierung.
   */
  /** Prognose fürs Dashboard: wann fährt man wieder, was wird bis dahin fällig. */
  fetchNextRide(bikeId: number) {
    return this.http.get<NextRideForecast>(`${this.baseUrl}/bikes/${bikeId}/next-ride/`);
  }

  fetchConditionReport(bikeId: number, refresh = false) {
    const params = refresh ? '?refresh=true' : '';
    return this.http.get<BikeConditionReport>(
      `${this.baseUrl}/bikes/${bikeId}/condition-report/${params}`,
    );
  }

  /**
   * Setzt das Einbaudatum fuer ALLE montierten Teile auf einmal — ohne `assemblyId` fuer
   * alles, was am Rad ist, sonst nur fuer diese Baugruppe. Die km zaehlen danach aus den
   * Fahrten ab diesem Tag.
   */
  setInstalledAtForAll(bikeId: number, installedAt: string, assemblyId?: number) {
    const body: { installed_at: string; assembly_id?: number } = {
      installed_at: installedAt,
    };
    if (assemblyId != null) body.assembly_id = assemblyId;
    return this.http.post<BulkInstalledAtResult>(
      `${this.baseUrl}/bikes/${bikeId}/installed-at/`,
      body,
    );
  }

  // ── Teile ──────────────────────────────────────────────────────────────────

  addComponent(slotId: number, payload: CreateComponentPayload) {
    return this.http.post<BikeComponent>(`${this.baseUrl}/slots/${slotId}/components/`, payload);
  }

  fetchComponent(componentId: number) {
    return this.http.get<BikeComponent>(`${this.baseUrl}/components/${componentId}/`);
  }

  updateComponent(componentId: number, payload: UpdateComponentPayload) {
    return this.http.patch<BikeComponent>(`${this.baseUrl}/components/${componentId}/`, payload);
  }

  deleteComponent(componentId: number) {
    return this.http.delete(`${this.baseUrl}/components/${componentId}/`);
  }

  /** Dieses Teil drauf, das bisherige wandert ins Regal. Ab da zaehlen die km hierfuer. */
  mountComponent(componentId: number, on?: string | null) {
    return this.http.post<BikeComponent>(
      `${this.baseUrl}/components/${componentId}/mount/`,
      dayBody(on),
    );
  }

  /** Abnehmen, aber behalten: liegt danach im Regal. */
  unmountComponent(componentId: number, on?: string | null) {
    return this.http.post<BikeComponent>(
      `${this.baseUrl}/components/${componentId}/unmount/`,
      dayBody(on),
    );
  }

  retireComponent(componentId: number, on?: string | null) {
    return this.http.post<BikeComponent>(
      `${this.baseUrl}/components/${componentId}/retire/`,
      dayBody(on),
    );
  }

  /** Aus Versehen ausgemustert, oder doch noch gut: zurueck ins Regal. */
  restoreComponent(componentId: number) {
    return this.http.post<BikeComponent>(`${this.baseUrl}/components/${componentId}/restore/`, {});
  }

  /** Auf einen anderen Platz gleicher Art umziehen, z.B. auf das andere Laufrad. */
  moveComponent(componentId: number, slotId: number, mount = true, on?: string | null) {
    return this.http.post<BikeComponent>(`${this.baseUrl}/components/${componentId}/move/`, {
      slot_id: slotId,
      mount,
      ...dayBody(on),
    });
  }

  checkComponent(componentId: number, payload: ComponentCheckPayload) {
    return this.http.post<BikeComponent>(
      `${this.baseUrl}/components/${componentId}/check/`,
      payload,
    );
  }

  undoCheck(componentId: number) {
    return this.http.delete<BikeComponent>(`${this.baseUrl}/components/${componentId}/check/`);
  }

  fetchWeatherExplanation(componentId: number, refresh = false) {
    const params = refresh ? '?refresh=true' : '';
    return this.http.get<WeatherWearExplanation>(
      `${this.baseUrl}/components/${componentId}/weather-explanation/${params}`,
    );
  }

  fetchCheckInstructions(componentId: number, refresh = false) {
    const params = refresh ? '?refresh=true' : '';
    return this.http.get<CheckInstructions>(
      `${this.baseUrl}/components/${componentId}/check-instructions/${params}`,
    );
  }

  // ── Plaetze ────────────────────────────────────────────────────────────────

  renameSlot(slotId: number, customName: string) {
    return this.http.patch<ComponentSlot>(`${this.baseUrl}/slots/${slotId}/`, {
      custom_name: customName,
    });
  }

  /** Der Platz samt aller seiner Teile. Der Aufrufer hat nachgefragt. */
  deleteSlot(slotId: number) {
    return this.http.delete(`${this.baseUrl}/slots/${slotId}/?confirm=true`);
  }

  // ── Katalog ────────────────────────────────────────────────────────────────

  fetchGroups(bikeType?: string) {
    const params = bikeType ? `?bike_type=${bikeType}` : '';
    return this.http.get<ComponentGroupCatalog[]>(`${this.baseUrl}/groups/${params}`);
  }

  createTemplate(payload: CreateTemplatePayload) {
    return this.http.post<ComponentTemplate>(`${this.baseUrl}/templates/`, payload);
  }

  // ── Kudo ───────────────────────────────────────────────────────────────────

  /** Kudo, Schritt 1: Hersteller (+ Baujahr) → Modellauswahl. */
  fetchKudoModels(manufacturer: string, year: number | null, bikeType: string) {
    return this.http.post<{ models: KudoModelCandidate[] }>(`${this.baseUrl}/assistant/models/`, {
      manufacturer,
      year,
      bike_type: bikeType,
    });
  }

  /** Kudo, Schritt 2: gewähltes Modell → Vorbelegung für den Setup-Stepper. */
  fetchKudoSetup(
    bikeId: number,
    manufacturer: string,
    model: string,
    year: number | null,
    spec = '',
  ) {
    return this.http.post<KudoSetupSuggestion>(
      `${this.baseUrl}/bikes/${bikeId}/assistant/setup/`,
      { manufacturer, model, year, spec },
    );
  }

  // ── Baugruppen ─────────────────────────────────────────────────────────────

  fetchAssemblies(bikeId: number) {
    return this.http.get<AssembliesResponse>(`${this.baseUrl}/bikes/${bikeId}/assemblies/`);
  }

  createAssembly(bikeId: number, payload: CreateAssemblyPayload) {
    return this.http.post<BikeAssembly>(`${this.baseUrl}/bikes/${bikeId}/assemblies/`, payload);
  }

  renameAssembly(assemblyId: number, name: string) {
    return this.http.patch<BikeAssembly>(`${this.baseUrl}/assemblies/${assemblyId}/`, { name });
  }

  /** Endgültig, samt aller Teile und ihres Verlaufs. Der Aufrufer hat nachgefragt. */
  deleteAssembly(assemblyId: number) {
    return this.http.delete(`${this.baseUrl}/assemblies/${assemblyId}/?confirm=true`);
  }

  /** Ergaenzt eine bestehende Baugruppe um ein einzelnes Teil oder Intervall. */
  addAssemblyItem(assemblyId: number, payload: AddAssemblyItemPayload) {
    return this.http.post(`${this.baseUrl}/assemblies/${assemblyId}/items/`, payload);
  }

  /** Was beim Aufziehen alles mitwechseln wuerde — aendert nichts. */
  fetchActivationPlan(assemblyId: number) {
    return this.http.get<ActivationPlan>(`${this.baseUrl}/assemblies/${assemblyId}/activate/`);
  }

  /**
   * Zieht eine Baugruppe auf. Das gekoppelte andere Laufrad und die gekoppelten Teile
   * wechseln mit, der bisherige Satz wird geparkt und behaelt seine Teile.
   */
  activateAssembly(assemblyId: number, on?: string | null) {
    return this.http.post<BikeAssembly & { plan: ActivationPlan }>(
      `${this.baseUrl}/assemblies/${assemblyId}/activate/`,
      dayBody(on),
    );
  }

  /** Endgültig ausmustern (verkauft/entsorgt), wahlweise den ganzen Satz. */
  retireAssembly(assemblyId: number, withLinked = false, on?: string | null) {
    return this.http.post<BikeAssembly>(`${this.baseUrl}/assemblies/${assemblyId}/retire/`, {
      with_linked: withLinked,
      ...dayBody(on),
    });
  }

  restoreAssembly(assemblyId: number) {
    return this.http.post<BikeAssembly>(`${this.baseUrl}/assemblies/${assemblyId}/restore/`, {});
  }

  /** Legt fest, was beim Aufziehen mitwechselt. Ersetzt die bisherige Auswahl. */
  setAssemblyLinks(assemblyId: number, assemblyIds: number[], componentIds: number[]) {
    return this.http.put<BikeAssembly>(`${this.baseUrl}/assemblies/${assemblyId}/links/`, {
      assembly_ids: assemblyIds,
      component_ids: componentIds,
    });
  }

  // ── Wartungs-Intervalle (Verbrauchsmaterial / Pflege) ──────────────────────

  addInterval(bikeId: number, payload: CreateIntervalPayload) {
    return this.http.post<MaintenanceInterval>(`${this.baseUrl}/bikes/${bikeId}/intervals/`, payload);
  }

  updateInterval(intervalId: number, patch: Partial<MaintenanceInterval>) {
    return this.http.patch<MaintenanceInterval>(`${this.baseUrl}/intervals/${intervalId}/`, patch);
  }

  deleteInterval(intervalId: number) {
    return this.http.delete(`${this.baseUrl}/intervals/${intervalId}/`);
  }

  logInterval(intervalId: number, payload: IntervalLogPayload = {}) {
    return this.http.post<MaintenanceInterval>(
      `${this.baseUrl}/intervals/${intervalId}/log/`,
      payload,
    );
  }

  /** Aus Versehen auf "Erledigt" getippt: stellt den Stand davor wieder her. */
  undoIntervalLog(intervalId: number) {
    return this.http.delete<MaintenanceInterval>(`${this.baseUrl}/intervals/${intervalId}/log/`);
  }
}
