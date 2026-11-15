import { describe, expect, it } from 'vitest';
import {
  BikeAssembly,
  BikeComponent,
  ComponentSlot,
  MaintenanceInterval,
} from '../../models/maintenance.models';
import {
  buildBoard,
  buildDueList,
  buildWheelSets,
  dayParam,
  moveTargets,
  partsLabel,
  ratioPercent,
  todayIso,
  worstStatus,
} from './utils';

function wheel(id: number, overrides: Partial<BikeAssembly> = {}): BikeAssembly {
  return {
    id,
    name: '',
    display_name: `Laufrad ${id}`,
    is_active: false,
    is_parked: true,
    is_retired: false,
    worst_status: 'ok',
    linked_assembly_ids: [],
    linked_component_ids: [],
    slots: [],
    intervals: [],
    group: id,
    group_detail: { kind: 'assembly', sort_order: id },
    ...overrides,
  } as unknown as BikeAssembly;
}

function part(id: number, ratio: number | null): BikeComponent {
  return {
    id,
    label: `Teil ${id}`,
    wear_km: 100,
    wear_ratio: ratio,
    effective_warn_km: 1000,
    warn_status_overall: 'ok',
  } as unknown as BikeComponent;
}

function slot(id: number, mounted: BikeComponent | null, template = id): ComponentSlot {
  return {
    id,
    template,
    display_name: `Platz ${id}`,
    mounted_component: mounted,
    spare_components: [],
    retired_components: [],
  } as unknown as ComponentSlot;
}

describe('buildBoard', () => {
  const area = (id: number, group: number, overrides: Partial<BikeAssembly> = {}) =>
    wheel(id, { group, group_detail: { kind: 'area', sort_order: 9 }, ...overrides } as never);

  it('stellt den Satz am Rad links, den im Keller rechts', () => {
    const board = buildBoard(
      [
        wheel(1, { name: 'Carbon vorne', is_active: true, linked_assembly_ids: [2] }),
        wheel(2, { name: 'Carbon hinten', is_active: true, linked_assembly_ids: [1] }),
      ],
      [
        wheel(3, { name: 'Alu vorne', linked_assembly_ids: [4] }),
        wheel(4, { name: 'Alu hinten', linked_assembly_ids: [3] }),
      ],
    );
    expect(board.rad.map((e) => e.name)).toEqual(['Carbon']);
    expect(board.keller.map((e) => e.name)).toEqual(['Alu']);
    expect(board.keller[0].target.id).toBe(3);
  });

  it('wechselt bei einem halb aufgezogenen Satz über das fehlende Laufrad', () => {
    const board = buildBoard(
      [wheel(1, { name: 'Carbon vorne', is_active: true, linked_assembly_ids: [2] })],
      [wheel(2, { name: 'Carbon hinten', linked_assembly_ids: [1] })],
    );
    expect(board.rad[0].partial).toBe(true);
    expect(board.rad[0].target.id).toBe(2);
  });

  it('zeigt Bereiche nur, wenn es eine Alternative im Keller gibt', () => {
    const board = buildBoard(
      [
        area(10, 7, { is_active: true, display_name: 'Alu-Beläge' }),
        area(11, 8, { is_active: true }),
      ],
      [area(12, 7, { display_name: 'Carbon-Beläge' })],
    );
    expect(board.rad.map((e) => e.key)).toEqual(['a10']);
    expect(board.keller[0].instead).toBe('Alu-Beläge');
  });
});

describe('buildWheelSets', () => {
  it('fasst gekoppelte Laufräder zu einem Satz zusammen', () => {
    const sets = buildWheelSets([
      wheel(1, { name: 'Carbon vorne', linked_assembly_ids: [2] }),
      wheel(2, { name: 'Carbon hinten', linked_assembly_ids: [1] }),
    ]);
    expect(sets).toHaveLength(1);
    expect(sets[0].name).toBe('Carbon');
    expect(sets[0].wheels.map((w) => w.id)).toEqual([1, 2]);
  });

  it('lässt ein ungekoppeltes Laufrad für sich stehen', () => {
    const sets = buildWheelSets([
      wheel(1, { name: 'Carbon vorne', display_name: 'Carbon vorne' }),
      wheel(2, { name: 'Alu hinten', display_name: 'Alu hinten' }),
    ]);
    expect(sets.map((set) => set.name)).toEqual(['Carbon vorne', 'Alu hinten']);
  });

  it('nimmt beide Namen, wenn es kein gemeinsames erstes Wort gibt', () => {
    const [set] = buildWheelSets([
      wheel(1, { name: 'Carbon', display_name: 'Carbon', linked_assembly_ids: [2] }),
      wheel(2, { name: 'Alu', display_name: 'Alu', linked_assembly_ids: [1] }),
    ]);
    expect(set.name).toBe('Carbon + Alu');
  });

  it('stellt den Satz am Rad nach vorne und meldet, ob er komplett drauf ist', () => {
    const sets = buildWheelSets([
      wheel(1, { name: 'Alu', display_name: 'Alu' }),
      wheel(2, {
        name: 'Carbon',
        display_name: 'Carbon',
        is_active: true,
        linked_assembly_ids: [3],
      }),
      wheel(3, { name: 'Carbon', display_name: 'Carbon', linked_assembly_ids: [2] }),
    ]);
    expect(sets[0].name).toBe('Carbon');
    expect(sets[0].onBike).toBe(true);
    expect(sets[0].fullyOn).toBe(false);
  });

  it('ignoriert Bereiche wie die Bremse', () => {
    const brake = wheel(1, { group_detail: { kind: 'area' } } as Partial<BikeAssembly>);
    expect(buildWheelSets([brake])).toEqual([]);
  });

  it('übernimmt den schlechtesten Status des Satzes', () => {
    const [set] = buildWheelSets([
      wheel(1, { worst_status: 'ok', linked_assembly_ids: [2] }),
      wheel(2, { worst_status: 'critical', linked_assembly_ids: [1] }),
    ]);
    expect(set.status).toBe('critical');
  });
});

describe('buildDueList', () => {
  it('sortiert Teile und Pflege nach derselben Kennzahl', () => {
    const interval = {
      id: 7,
      label: 'Kette ölen',
      usage_ratio: 0.9,
      status: 'warn',
      interval_km: 300,
      km_since: 270,
    } as unknown as MaintenanceInterval;
    const items = buildDueList([
      wheel(1, {
        slots: [slot(1, part(1, 0.2)), slot(2, part(2, 1.4))],
        intervals: [interval],
      }),
    ]);
    expect(items.map((item) => item.key)).toEqual(['part-2', 'interval-7', 'part-1']);
  });

  it('stellt Posten ohne Datenbasis ans Ende', () => {
    const items = buildDueList([
      wheel(1, { slots: [slot(1, part(1, null)), slot(2, part(2, 0.1))] }),
    ]);
    expect(items.map((item) => item.key)).toEqual(['part-2', 'part-1']);
  });

  it('kennt keinen leeren Platz', () => {
    expect(buildDueList([wheel(1, { slots: [slot(1, null)] })])).toEqual([]);
  });
});

describe('moveTargets', () => {
  const garage = {
    assemblies: [wheel(1, { slots: [slot(11, null, 5), slot(12, null, 6)] })],
    parked_assemblies: [wheel(2, { slots: [slot(21, null, 5)] })],
    retired_assemblies: [wheel(3, { slots: [slot(31, null, 5)] })],
    ungrouped_slots: [],
    spare_components: [],
    available_groups: [],
  };

  it('findet Plätze gleicher Art an anderen Laufrädern, nicht den eigenen', () => {
    const targets = moveTargets(garage, 5, 11);
    expect(targets.map((target) => target.slot.id)).toEqual([21]);
  });

  it('bietet keine ausgemusterte Baugruppe an', () => {
    expect(moveTargets(garage, 5, 21).map((target) => target.slot.id)).toEqual([11]);
  });
});

describe('kleine Helfer', () => {
  it('schickt heute nicht mit, nur einen anderen Tag', () => {
    expect(dayParam(todayIso())).toBeNull();
    expect(dayParam('2020-01-01')).toBe('2020-01-01');
    expect(dayParam(null)).toBeNull();
  });

  it('nimmt den lokalen Kalendertag', () => {
    const now = new Date();
    expect(todayIso()).toBe(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    );
  });

  it('begrenzt den Balken auf 100 %, auch wenn etwas überfällig ist', () => {
    expect(ratioPercent(0.5)).toBe(50);
    expect(ratioPercent(3)).toBe(100);
    expect(ratioPercent(null)).toBe(0);
  });

  it('dekliniert Teile', () => {
    expect(partsLabel(1)).toBe('1 Teil');
    expect(partsLabel(2)).toBe('2 Teile');
  });

  it('kennt den schlechtesten Status', () => {
    expect(worstStatus(['ok', 'warn'])).toBe('warn');
    expect(worstStatus(['unknown', 'ok'])).toBe('ok');
    expect(worstStatus([])).toBe('unknown');
  });
});
