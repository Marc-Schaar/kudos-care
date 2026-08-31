/**
 * Was eine einzelne Fahrt die Komponenten gekostet hat
 * (`GET /api/activities/<id>/wear-impact/`).
 *
 * Der wetterbedingte Aufschlag hängt an der Komponenten-Kategorie — dort liegen die
 * Sensitivitäts-Koeffizienten. Deshalb ist die Kategorie die Gruppierung: alle
 * Bremsen-Teile teilen sich denselben Prozentsatz, nur `share_of_life_pct`
 * unterscheidet sich je Komponente (unterschiedliche empfohlene Lebensdauer).
 */

export type WearDriver = 'rain' | 'heat' | 'cold' | 'wind';

export interface WearImpactComponent {
  id: number;
  name: string;
  brand: string;
  model_name: string;
  /** Wettergewichtete km, die diese Fahrt der Komponente gekostet hat. */
  effective_km: number;
  /** Aufschlag gegenüber der reinen Distanz, in km. */
  extra_km: number;
  warn_km: number | null;
  /** Anteil an der empfohlenen Lebensdauer, den diese eine Fahrt verbraucht hat. */
  share_of_life_pct: number | null;
}

export interface WearImpactCategory {
  category: string;
  category_display: string;
  multiplier: number;
  extra_pct: number;
  extra_km: number;
  dominant_driver: WearDriver | null;
  dominant_driver_display: string | null;
  components: WearImpactComponent[];
}

export interface WearImpactConditions {
  precipitation: number | null;
  temperature: number | null;
  wind_speed: number | null;
}

export interface WearImpactBreakdown {
  distance_km: number | null;
  conditions: WearImpactConditions;
  categories: WearImpactCategory[];
  total_extra_km: number;
  component_count: number;
}

export interface WearImpactResponse {
  breakdown: WearImpactBreakdown;
  /** KI-Erzähltext. Leer, wenn `ai_unavailable` gesetzt ist — die Zahlen stehen für sich. */
  summary: string;
  generated_at: string | null;
  cached: boolean;
  ai_unavailable?: boolean;
}
