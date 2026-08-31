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

export interface ComponentTemplate {
  id: number;
  name: string;
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
  notes: string;
  group: number | null;
  group_name: string | null;
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

export interface BikeComponent {
  id: number;
  slot: number;
  brand: string;
  model_name: string;
  distance_at_install: number | null;
  installed_at: string | null; // ISO date string
  retired_at: string | null;
  is_mounted: boolean;
  notes: string;
  custom_warn_km: number | null;
  custom_warn_days: number | null;
  created_at: string;
  updated_at: string;
  // berechnete Felder vom Backend
  wear_km: number | null;
  wear_days: number | null;
  warn_status_km: WarnStatus;
  warn_status_days: WarnStatus;
  weather_wear_km: number | null;
  weather_wear_computed_at: string | null;
  weather_wear_ride_count: number | null;
  warn_status_weather_km: WarnStatus;
  warn_status_overall: WarnStatus;
  last_check: ComponentCheckSummary | null;
}

export interface CreateComponentPayload {
  brand: string;
  model_name: string;
  distance_at_install: number | null;
  installed_at: string | null;
  is_mounted: boolean;
  notes: string;
  custom_warn_km: number | null;
  custom_warn_days: number | null;
}

// ── ComponentSlot ─────────────────────────────────────────────────────────────

export interface MountedComponentSummary {
  id: number;
  brand: string;
  model_name: string;
  installed_at: string | null;
  condition_pct: number | null;
  wear_km: number | null;
  wear_days: number | null;
  effective_warn_km: number | null;
  effective_warn_days: number | null;
  warn_status_overall: WarnStatus;
  weather_wear_km: number | null;
  weather_wear_ride_count: number | null;
  warn_status_weather_km: WarnStatus;
}

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

export interface ComponentSlotList {
  id: number;
  bike: number;
  template: number;
  template_detail: ComponentTemplate;
  display_name: string;
  category: ComponentCategory;
  category_display: string;
  warn_status: WarnStatus;
  mounted_component: MountedComponentSummary | null;
}

export interface ComponentSlotDetail extends ComponentSlotList {
  custom_name: string;
  template_detail: ComponentTemplate;
  components: BikeComponent[];
}

// ── Quick-Change (Baugruppen-Tausch) ───────────────────────────────────────────

export interface ComponentGroupRef {
  id: number;
  name: string;
}

export interface QuickChangeItem {
  slot_id: number;
  display_name: string;
  preselected: boolean;
  mounted_component: { brand: string; model_name: string; installed_at: string | null } | null;
}

export interface QuickChangeGroupResponse {
  group: ComponentGroupRef;
  items: QuickChangeItem[];
}

export interface QuickChangeRequestItem {
  slot_id: number;
  include: boolean;
  brand?: string;
  model_name?: string;
}

export interface QuickChangeRequest {
  installed_at?: string;
  items: QuickChangeRequestItem[];
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
  parts: ComponentTemplate[];
  consumables: ComponentTemplate[];
}

// ── Wartungs-Intervall (Verbrauchsmaterial / Pflege) ─────────────────────────

export interface MaintenanceLog {
  id: number;
  done_at: string;
  done_distance_km: number | null;
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
  last_done_distance_km: number | null;
  notes: string;
  status: WarnStatus;
  km_since: number | null;
  days_since: number | null;
  last_log: MaintenanceLog | null;
}

export interface IntervalLogPayload {
  done_at?: string;
  done_distance_km?: number | null;
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

export interface BikeAssembly {
  id: number;
  bike: number;
  group: number;
  group_detail: ComponentGroupCatalog;
  name: string;
  display_name: string;
  installed_at: string | null;
  retired_at: string | null;
  is_active: boolean;
  slots: ComponentSlotList[];
  intervals: MaintenanceInterval[];
  assembly_km: number | null;
  worst_status: WarnStatus;
  created_at: string;
  updated_at: string;
}

export interface AssembliesResponse {
  assemblies: BikeAssembly[];
  ungrouped_slots: ComponentSlotList[];
  available_groups: ComponentGroupCatalog[];
}

export interface AssemblyPartItem {
  template_id: number;
  include: boolean;
  brand?: string;
  model_name?: string;
  custom_warn_km?: number | null;
  custom_warn_days?: number | null;
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
}

// ── Bike ──────────────────────────────────────────────────────────────────────

export interface BikeList {
  id: number;
  strava_bike_id: number;
  name: string;
  bike_type: BikeType;
  bike_type_display: string;
  retired: boolean;
  total_distance_km: number | null;
  warn_status: WarnStatus;
}

export interface BikeDetail extends BikeList {
  slots: ComponentSlotList[];
  created_at: string;
  updated_at: string;
}

// ── Kategorie-Gruppierung (Frontend-only) ─────────────────────────────────────

export interface SlotGroup {
  category: ComponentCategory;
  category_display: string;
  slots: ComponentSlotList[];
  worst_status: WarnStatus;
}

export const CATEGORY_ORDER: ComponentCategory[] = [
  'drivetrain',
  'brakes',
  'wheels',
  'suspension',
  'cockpit',
  'frame',
  'electric',
  'lighting',
  'other',
];

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

export interface KudoModelCandidate {
  model: string;
  year_range: string;
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
  groups: KudoGroupSuggestion[];
}

/** Vorbelegung je Baugruppe, wie der Stepper sie an die Checkliste durchreicht. */
export type KudoPrefill = ReadonlyMap<number, KudoGroupSuggestion>;
