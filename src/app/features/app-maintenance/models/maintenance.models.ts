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
