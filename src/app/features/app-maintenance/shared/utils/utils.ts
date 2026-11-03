import {
  AssembliesResponse,
  BikeAssembly,
  BikeComponent,
  ComponentSlot,
  MaintenanceInterval,
  WarnStatus,
} from '../../models/maintenance.models';

const STATUS_PRIORITY: WarnStatus[] = ['critical', 'warn', 'ok', 'unknown'];

/** Der schlechteste Status einer Sammlung — dieselbe Reihenfolge wie im Backend. */
export function worstStatus(statuses: WarnStatus[]): WarnStatus {
  return STATUS_PRIORITY.find((status) => statuses.includes(status)) ?? 'unknown';
}

/** Heute im lokalen Kalender. `toISOString()` wäre nach Mitternacht noch beim Vortag. */
export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Fürs Backend: heute heißt "jetzt", nur ein anderer Tag wird mitgeschickt. */
export function dayParam(value: string | null | undefined): string | null {
  return value && value !== todayIso() ? value : null;
}

/** Verbrauchter Anteil für einen Balken: 0–100, auch wenn das Teil überfällig ist. */
export function ratioPercent(ratio: number | null | undefined): number {
  return ratio == null ? 0 : Math.min(Math.round(ratio * 100), 100);
}

export function partsLabel(count: number): string {
  return `${count} ${count === 1 ? 'Teil' : 'Teile'}`;
}

// ── Laufradsätze ─────────────────────────────────────────────────────────────

export interface WheelSet {
  key: string;
  name: string;
  wheels: BikeAssembly[];
  /** Mindestens ein Laufrad ist gerade am Rad. */
  onBike: boolean;
  /** Alle Laufräder des Satzes sind am Rad, es gibt also nichts zu wechseln. */
  fullyOn: boolean;
  status: WarnStatus;
}

/**
 * "Carbon vorne" + "Carbon hinten" heißen als Satz "Carbon". Ohne gemeinsames erstes Wort
 * bleiben beide Namen stehen: raten wäre schlimmer als ein langer Titel.
 */
function setName(wheels: BikeAssembly[]): string {
  if (wheels.length === 1) return wheels[0].display_name;
  const firstWords = wheels.map((wheel) => wheel.name.trim().split(/\s+/)[0] ?? '');
  if (firstWords[0] && firstWords.every((word) => word === firstWords[0])) return firstWords[0];
  if (wheels.every((wheel) => !wheel.name.trim())) return 'Laufradsatz';
  return wheels.map((wheel) => wheel.display_name).join(' + ');
}

/** Fasst gekoppelte Laufräder zu Sätzen zusammen — der Satz am Rad steht vorne. */
export function buildWheelSets(assemblies: BikeAssembly[]): WheelSet[] {
  const wheels = assemblies.filter((assembly) => assembly.group_detail.kind === 'assembly');
  const byId = new Map(wheels.map((wheel) => [wheel.id, wheel]));
  const seen = new Set<number>();
  const sets: WheelSet[] = [];

  for (const wheel of wheels) {
    if (seen.has(wheel.id)) continue;
    const members: BikeAssembly[] = [];
    const queue = [wheel];
    while (queue.length) {
      const current = queue.shift()!;
      if (seen.has(current.id)) continue;
      seen.add(current.id);
      members.push(current);
      for (const linkedId of current.linked_assembly_ids) {
        const linked = byId.get(linkedId);
        if (linked) queue.push(linked);
      }
    }
    members.sort((a, b) => a.group_detail.sort_order - b.group_detail.sort_order);
    sets.push({
      key: members.map((member) => member.id).join('-'),
      name: setName(members),
      wheels: members,
      onBike: members.some((member) => member.is_active),
      fullyOn: members.every((member) => member.is_active),
      status: worstStatus(members.map((member) => member.worst_status)),
    });
  }

  return sets.sort((a, b) => Number(b.onBike) - Number(a.onBike));
}

// ── Was als Nächstes dran ist ────────────────────────────────────────────────

export interface DueItem {
  key: string;
  ratio: number | null;
  status: WarnStatus;
  title: string;
  where: string;
  detail: string;
  assembly: BikeAssembly;
  slot?: ComponentSlot;
  component?: BikeComponent;
  interval?: MaintenanceInterval;
}

function partDetail(component: BikeComponent): string {
  const km = `${Math.round(component.wear_km).toLocaleString('de-DE')} km`;
  return component.effective_warn_km
    ? `${km} von ${component.effective_warn_km.toLocaleString('de-DE')} km`
    : km;
}

function intervalDetail(interval: MaintenanceInterval): string {
  if (interval.interval_km) {
    return `${Math.round(interval.km_since).toLocaleString('de-DE')} von ${interval.interval_km.toLocaleString('de-DE')} km`;
  }
  if (interval.interval_days && interval.days_since != null) {
    return `${interval.days_since} von ${interval.interval_days} Tagen`;
  }
  return 'Pflege';
}

/**
 * Teile und Intervalle auf derselben Kennzahl (verbrauchter Anteil), damit "als Nächstes
 * dran" eine echte Reihenfolge ist statt zweier Listen. Posten ohne Datenbasis stehen hinten.
 */
export function buildDueList(assemblies: BikeAssembly[]): DueItem[] {
  const items: DueItem[] = [];
  for (const assembly of assemblies) {
    for (const slot of assembly.slots) {
      const component = slot.mounted_component;
      if (!component) continue;
      items.push({
        key: `part-${component.id}`,
        ratio: component.wear_ratio,
        status: component.warn_status_overall,
        title: slot.display_name,
        where: assembly.display_name,
        detail: partDetail(component),
        assembly,
        slot,
        component,
      });
    }
    for (const interval of assembly.intervals) {
      items.push({
        key: `interval-${interval.id}`,
        ratio: interval.usage_ratio,
        status: interval.status,
        title: interval.label,
        where: assembly.display_name,
        detail: intervalDetail(interval),
        assembly,
        interval,
      });
    }
  }
  return items.sort((a, b) => (b.ratio ?? -1) - (a.ratio ?? -1));
}

// ── Wohin ein Teil passt ─────────────────────────────────────────────────────

/** Alle Baugruppen des Rads, die nicht ausgemustert sind. */
export function liveAssemblies(garage: AssembliesResponse): BikeAssembly[] {
  return [...garage.assemblies, ...garage.parked_assemblies];
}

/** Plätze gleicher Art an anderen Baugruppen — dorthin kann ein Teil umziehen. */
export function moveTargets(
  garage: AssembliesResponse,
  template: number,
  currentSlot: number,
): { slot: ComponentSlot; assembly: BikeAssembly }[] {
  const targets: { slot: ComponentSlot; assembly: BikeAssembly }[] = [];
  for (const assembly of liveAssemblies(garage)) {
    for (const slot of assembly.slots) {
      if (slot.template === template && slot.id !== currentSlot) {
        targets.push({ slot, assembly });
      }
    }
  }
  return targets;
}
