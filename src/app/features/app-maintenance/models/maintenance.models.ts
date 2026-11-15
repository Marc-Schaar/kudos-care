// ── Enums ─────────────────────────────────────────────────────────────────────

export type BikeType =
  | 'road'
  | 'mtb'
  | 'gravel'
  | 'ebike_road'
  | 'ebike_mtb'
  | 'ebike_city'
  | 'city'
  | 'cx'
  | 'triathlon'
  | 'other';

export type ComponentCategory =
  | 'drivetrain'
  | 'brakes'
  | 'wheels'
  | 'suspension'
  | 'cockpit'
  | 'frame'
  | 'electric'
  | 'lighting'
  | 'other';

export type WarnStatus = 'ok' | 'warn' | 'critical' | 'unknown';

export type MaintenanceKind = 'part' | 'consumable';

export type MaintenanceIntervalKind =
  | 'chain_lube'
  | 'sealant'
  | 'brake_bleed'
  | 'di2_charge'
  | 'battery'
  | 'custom';

// ── ComponentTemplate ─────────────────────────────────────────────────────────

/** Seite am Rad — ein Feld, kein Wort im Namen (Backend: MountPosition). */
export type MountPosition = 'front' | 'rear' | '';

/**
 * `assembly` = physische Einheit, am Stück wechselbar (Laufrad). Davon darf es
 * mehrere je Rad geben, eine davon ist aufgezogen.
 * `area` = Teile am selben Ort, die unabhängig verschleißen (Bremse, Cockpit). Gibt
 * es je Rad einmal; getauscht wird dort pro Platz.
 */
export type GroupKind = 'assembly' | 'area';

export interface ComponentTemplate {
  id: number;
  name: string;
  /** Seite am Rad. Leer = ohne Seite. */
  position: MountPosition;
  category: ComponentCategory;
  category_display: string;
  applicable_bike_types: BikeType[];
  warn_km: number | null;
  warn_hours: number | null;
  warn_days: number | null;
  is_system: boolean;
  supports_condition_estimate: boolean;
  maintenance_kind: MaintenanceKind;
  default_in_group: boolean;
  /** Sitzt nicht auf dem Laufrad, muss aber dazu passen (Bremsbeläge, Scheiben). */
  follows_wheel: boolean;
  notes: string;
  group: number | null;
  group_name: string | null;
}

export interface CreateTemplatePayload {
  name: string;
  category: ComponentCategory;
  group: number;
  maintenance_kind: MaintenanceKind;
  applicable_bike_types: BikeType[];
  warn_km?: number | null;
  warn_days?: number | null;
}

// ── ComponentCheck ("Prüfen/Freigeben") ────────────────────────────────────────

export interface ComponentCheckSummary {
  checked_at: string;
  condition_pct: number | null;
  snooze_km: number | null;
  snooze_days: number | null;
  note: string;
}

export interface ComponentCheckPayload {
  condition_pct?: number | null;
  snooze_km?: number | null;
  snooze_days?: number | null;
  note?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

/** montiert = am Platz, spare = im Regal und noch gut, retired = ausgemustert. */
export type ComponentStatus = 'mounted' | 'spare' | 'retired';

/** Ein Einsatz des Teils. Die km ergeben sich aus den Fahrten in diesem Zeitraum. */
export interface UsagePeriod {
  id: number;
  started_at: string;
  ended_at: string | null;
  km: number;
}

export interface BikeComponent {
  id: number;
  slot: number;
  /** Marke + Modell, sonst der Name des Platzes. */
  label: string;
  brand: string;
  model_name: string;
  status: ComponentStatus;
  is_mounted: boolean;
  installed_at: string | null;
  retired_at: string | null;
  /** Km, die das Teil schon hatte, bevor es hier erfasst wurde. */
  prior_km: number | null;
  notes: string;
  custom_warn_km: number | null;
  custom_warn_days: number | null;
  effective_warn_km: number | null;
  effective_warn_days: number | null;
  created_at: string;
  updated_at: string;
  wear_km: number;
  wear_days: number | null;
  /** Verbrauchter Anteil der Lebensdauer auf der schlechtesten Achse. */
  wear_ratio: number | null;
  warn_status_km: WarnStatus;
  warn_status_days: WarnStatus;
  weather_wear_km: number | null;
  weather_wear_computed_at: string | null;
  weather_wear_ride_count: number | null;
  warn_status_weather_km: WarnStatus;
  warn_status_overall: WarnStatus;
  condition_pct: number | null;
  last_check: ComponentCheckSummary | null;
  periods: UsagePeriod[];
}

export interface CreateComponentPayload {
  brand: string;
  model_name: string;
  notes?: string;
  custom_warn_km?: number | null;
  custom_warn_days?: number | null;
  prior_km?: number | null;
  /** Gleich aufziehen (das bisherige Teil wandert ins Regal) oder nur ins Regal legen. */
  mount: boolean;
  installed_at?: string;
}

export type UpdateComponentPayload = Partial<
  Pick<
    BikeComponent,
    | 'brand'
    | 'model_name'
    | 'notes'
    | 'custom_warn_km'
    | 'custom_warn_days'
    | 'prior_km'
    | 'installed_at'
  >
>;

// ── Wetter-Verschleiß-Erklärung (KI-generiert, on-demand) ──────────────────────

export interface WeatherWearExplanation {
  explanation: string;
  generated_at: string; // ISO datetime
  cached: boolean;
}

// ── Prüfanleitung (KI-generiert, on-demand) ────────────────────────────────────

export interface CheckInstructions {
  instructions: string;
  generated_at: string; // ISO datetime
  cached: boolean;
}

// ── Zustandsbericht (KI-generiert, on-demand, pro Bike) ───────────────────────

export interface BikeConditionReport {
  report: string;
  generated_at: string; // ISO datetime
  cached: boolean;
}

// ── Platz am Rad (ComponentSlot) ──────────────────────────────────────────────

export interface ComponentSlot {
  id: number;
  bike: number;
  assembly: number | null;
  template: number;
  template_detail: ComponentTemplate;
  custom_name: string;
  display_name: string;
  category: ComponentCategory;
  category_display: string;
  warn_status: WarnStatus;
  mounted_component: BikeComponent | null;
  spare_components: BikeComponent[];
  retired_components: BikeComponent[];
}

/** Ein Teil im Regal, mit seiner Herkunft. */
export interface SpareComponent {
  id: number;
  slot: number;
  slot_name: string;
  assembly: number | null;
  assembly_name: string | null;
  /** Seine Baugruppe ist ausgemustert: es braucht einen neuen Platz. */
  orphaned: boolean;
  template: number;
  label: string;
  brand: string;
  model_name: string;
  status: ComponentStatus;
  installed_at: string | null;
  retired_at: string | null;
  /** Bisher gefahrene km — bleiben bei einer Übernahme erhalten. */
  prior_wear_km: number;
}

// ── Baugruppen-Katalog (ComponentGroup) ──────────────────────────────────────

export interface ComponentGroupCatalog {
  id: number;
  name: string;
  notes: string;
  category: ComponentCategory;
  category_display: string;
  applicable_bike_types: BikeType[];
  sort_order: number;
  recommended: boolean;
  is_system: boolean;
  /** Steuert, ob "Wechseln" angeboten wird und ob es mehrere Instanzen geben darf. */
  kind: GroupKind;
  position: MountPosition;
  parts: ComponentTemplate[];
  consumables: ComponentTemplate[];
  /** True, wenn das Bike bereits eine aufgezogene Instanz dieser Gruppe hat. */
  has_active_instance: boolean;
}

// ── Wartungs-Intervall (Verbrauchsmaterial / Pflege) ─────────────────────────

export interface MaintenanceLog {
  id: number;
  done_at: string;
  note: string;
  created_at: string;
}

export interface MaintenanceInterval {
  id: number;
  bike: number;
  assembly: number | null;
  template: number | null;
  kind: MaintenanceIntervalKind;
  label: string;
  interval_km: number | null;
  interval_days: number | null;
  last_done_at: string | null;
  notes: string;
  status: WarnStatus;
  km_since: number;
  days_since: number | null;
  /** Verbrauchter Anteil des Intervalls, schlechteste Achse. */
  usage_ratio: number | null;
  last_log: MaintenanceLog | null;
}

export interface IntervalLogPayload {
  done_at?: string;
  note?: string;
}

export interface CreateIntervalPayload {
  assembly?: number | null;
  kind?: MaintenanceIntervalKind;
  label: string;
  interval_km?: number | null;
  interval_days?: number | null;
  last_done_at?: string;
  notes?: string;
}

// ── Baugruppe (BikeAssembly, Bike-Instanz) ───────────────────────────────────

export type AssemblyStatus = 'active' | 'parked' | 'retired';

export interface BikeAssembly {
  id: number;
  bike: number;
  group: number;
  group_detail: ComponentGroupCatalog;
  name: string;
  display_name: string;
  installed_at: string | null;
  retired_at: string | null;
  status: AssemblyStatus;
  is_active: boolean;
  /** Abgezogen, aber nicht entsorgt — z.B. der Sommer-LRS im Keller. */
  is_parked: boolean;
  is_retired: boolean;
  /** Bei geparkten Sätzen der Tag des Abziehens, bei aufgezogenen heute. */
  last_used_at: string | null;
  slots: ComponentSlot[];
  intervals: MaintenanceInterval[];
  assembly_km: number;
  worst_status: WarnStatus;
  periods: { started_at: string; ended_at: string | null }[];
  /** Was beim Aufziehen mitwechselt: das andere Laufrad des Satzes … */
  linked_assembly_ids: number[];
  /** … und einzelne Teile aus Bereichen wie der Bremse. */
  linked_component_ids: number[];
  created_at: string;
  updated_at: string;
}

export interface AssembliesResponse {
  assemblies: BikeAssembly[];
  /** Alternativen zum Wechseln (nicht am Rad, aber nicht ausgemustert). */
  parked_assemblies: BikeAssembly[];
  retired_assemblies: BikeAssembly[];
  ungrouped_slots: ComponentSlot[];
  spare_components: SpareComponent[];
  available_groups: ComponentGroupCatalog[];
}

/** Was ein Wechsel auslöst — Vorschau und Ergebnis haben dieselbe Form. */
export interface ActivationPlan {
  activate: { id: number; name: string; group_name: string }[];
  park: { id: number; name: string; group_name: string }[];
  mount: { component_id: number; label: string; slot_name: string; replaces: string | null }[];
  unpaired: { component_id: number; label: string; slot_name: string; from_assembly: string }[];
}

export interface AssemblyPartItem {
  template_id: number;
  include: boolean;
  brand?: string;
  model_name?: string;
  custom_warn_km?: number | null;
  custom_warn_days?: number | null;
  /**
   * Statt eine neue Komponente anzulegen: eine bereits vorhandene, noch
   * ungruppierte ComponentSlot-Id übernehmen (samt Verlauf). brand/model_name/
   * custom_warn_* werden dann vom Backend ignoriert.
   */
  existing_slot_id?: number;
  /**
   * Statt eine neue Komponente anzulegen: ein bereits ausgebautes Teil (siehe
   * `SpareComponent`) reaktivieren. Schließt sich mit `existing_slot_id` aus.
   */
  reuse_component_id?: number;
}

export interface AssemblyIntervalItem {
  template_id: number;
  include: boolean;
  interval_km?: number | null;
  interval_days?: number | null;
}

export interface CreateAssemblyPayload {
  group_id?: number;
  name?: string;
  installed_at?: string;
  parts: AssemblyPartItem[];
  intervals: AssemblyIntervalItem[];
  /**
   * Neue Instanz direkt aufziehen? Ohne Angabe entscheidet das Backend: ist die
   * Gruppe noch frei, wird aufgezogen — ist bereits ein Satz drauf, wird die
   * neue Instanz geparkt angelegt statt den bestehenden zu verdrängen.
   */
  activate?: boolean;
  /** Gleich mitkoppeln: das andere Laufrad des neuen Satzes. */
  linked_assembly_ids?: number[];
}

// ── Bike ──────────────────────────────────────────────────────────────────────

export interface BikeList {
  id: number;
  /** Null = von Hand angelegt, ohne Strava-Bezug. */
  strava_bike_id: string | null;
  name: string;
  bike_type: BikeType;
  bike_type_display: string;
  retired: boolean;
  total_distance_km: number | null;
  warn_status: WarnStatus;
}

export interface BikeDetail extends BikeList {
  slots: ComponentSlot[];
  created_at: string;
  updated_at: string;
}

export const BIKE_TYPE_LABELS: Record<BikeType, string> = {
  road: 'Rennrad',
  mtb: 'Mountainbike',
  gravel: 'Gravel',
  ebike_road: 'E-Rennrad',
  ebike_mtb: 'E-MTB',
  ebike_city: 'E-Stadtrad',
  city: 'Stadtrad',
  cx: 'Cyclocross',
  triathlon: 'Triathlon/Zeitfahrrad',
  other: 'Sonstiges',
};

// ── "Kudo" — KI-Assistent fürs Bike-Anlegen ──────────────────────────────────
// Vorschläge, keine Fakten: `confidence` sagt, wie sicher sich Kudo ist, und jede
// Zeile bleibt im Stepper editierbar. Die `template_id`s sind serverseitig gegen
// den Katalog geprüft (app_maintenance/api/bike_assistant.py).

export type KudoConfidence = 'high' | 'medium' | 'low';

/** Antwort von POST bikes/<id>/installed-at/. */
export interface BulkInstalledAtResult {
  installed_at: string;
  components_updated: number;
  assemblies_updated: number;
}

/** Body fuer POST assemblies/<id>/items/ — Teil ODER Verbrauchsmaterial. */
export interface AddAssemblyItemPayload {
  template_id: number;
  brand?: string;
  model_name?: string;
  installed_at?: string | null;
  custom_warn_km?: number | null;
  interval_km?: number | null;
  interval_days?: number | null;
}

export interface KudoModelCandidate {
  model: string;
  year_range: string;
  /** Serienausstattung in Stichworten. Wird angezeigt UND an Schritt 2 durchgereicht. */
  spec: string;
  confidence: KudoConfidence;
  note: string;
}

export interface KudoPartSuggestion {
  template_id: number;
  include: boolean;
  brand: string;
  model_name: string;
  custom_warn_km: number | null;
  custom_warn_days: number | null;
  confidence: KudoConfidence;
  note: string;
}

export interface KudoIntervalSuggestion {
  template_id: number;
  include: boolean;
  interval_km: number | null;
  interval_days: number | null;
  confidence: KudoConfidence;
  note: string;
}

export interface KudoGroupSuggestion {
  group_id: number;
  group_name: string;
  parts: KudoPartSuggestion[];
  intervals: KudoIntervalSuggestion[];
}

export interface KudoSetupSuggestion {
  manufacturer: string;
  model: string;
  year: number | null;
  /** Ausstattung, die Kudo ermittelt hat — die Teileauswahl wird dagegen geprueft. */
  spec: Record<string, string | boolean>;
  /** Ob wirklich im Web recherchiert wurde (sonst: aus dem Modellwissen). */
  researched: boolean;
  groups: KudoGroupSuggestion[];
}

/** Vorbelegung je Baugruppe, wie der Stepper sie an die Checkliste durchreicht. */
export type KudoPrefill = ReadonlyMap<number, KudoGroupSuggestion>;

// ── Prognose: nächste Fahrt ─────────────────────────────────────────────────

/** Ein Posten, der zur nächsten Fahrt mindestens bald fällig ist. Titel & Co. kommen aus `assemblies/`. */
export interface NextRideItem {
  kind: 'part' | 'interval';
  /** Component- bzw. Interval-Id, passt zu `DueItem.key` (`part-<id>` / `interval-<id>`). */
  id: number;
  status_today: WarnStatus;
  status_then: WarnStatus;
}

/** `GET maintenance/bikes/<id>/next-ride/`. Ohne genug Fahrten ist `predicted_date` null. */
export interface NextRideForecast {
  min_rides: number;
  ride_count: number;
  predicted_date: string | null;
  days_until?: number;
  /** Nach dem eigenen Rhythmus schon überfällig (Pause): dann ist `predicted_date` heute. */
  is_overdue?: boolean;
  predicted_km?: number | null;
  median_gap_days?: number;
  rides_considered?: number;
  last_ride?: string;
  items: NextRideItem[];
}
