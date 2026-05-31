import {
  CATEGORY_ORDER,
  ComponentSlotList,
  SlotGroup,
  WarnStatus,
} from '../../models/maintenance.models';

export function groupSlotsByCategory(slots: ComponentSlotList[]): SlotGroup[] {
  const STATUS_PRIORITY: WarnStatus[] = ['critical', 'warn', 'ok', 'unknown'];

  const map = new Map<string, SlotGroup>();

  for (const slot of slots) {
    if (!map.has(slot.category)) {
      map.set(slot.category, {
        category: slot.category,
        category_display: slot.category_display,
        slots: [],
        worst_status: 'unknown',
      });
    }
    map.get(slot.category)!.slots.push(slot);
  }

  for (const group of map.values()) {
    for (const priority of STATUS_PRIORITY) {
      if (group.slots.some((s) => s.warn_status === priority)) {
        group.worst_status = priority;
        break;
      }
    }
  }

  return CATEGORY_ORDER.filter((cat) => map.has(cat)).map((cat) => map.get(cat)!);
}

export function wearPercent(wearKm: number | null, warnKm: number | null): number {
  if (wearKm == null || warnKm == null || warnKm === 0) return 0;
  return Math.min(Math.round((wearKm / warnKm) * 100), 100);
}
