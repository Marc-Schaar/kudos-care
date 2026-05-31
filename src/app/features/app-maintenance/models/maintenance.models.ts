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
  notes: string;
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
  created_at: string;
  updated_at: string;
  // berechnete Felder vom Backend
  wear_km: number | null;
  wear_days: number | null;
  warn_status_km: WarnStatus;
  warn_status_days: WarnStatus;
  warn_status_overall: WarnStatus;
}

export interface CreateComponentPayload {
  brand: string;
  model_name: string;
  distance_at_install: number | null;
  installed_at: string | null;
  is_mounted: boolean;
  notes: string;
}

// ── ComponentSlot ─────────────────────────────────────────────────────────────

export interface MountedComponentSummary {
  id: number;
  brand: string;
  model_name: string;
  installed_at: string | null;
}

export interface ComponentSlotList {
  id: number;
  bike: number;
  template: number;
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

// ── Bike ──────────────────────────────────────────────────────────────────────

export interface BikeList {
  id: number;
  strava_bike_id: string;
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
  other: 'Sonstiges',
};
