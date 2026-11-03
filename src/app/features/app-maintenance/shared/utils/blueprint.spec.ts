import { describe, expect, it } from 'vitest';
import { BikeAssembly, BikeComponent, ComponentSlot } from '../../models/maintenance.models';
import { anchorFor, buildCallouts, largestWeatherGap, WIDE } from './blueprint';

function assembly(
  id: number,
  category: string,
  position: '' | 'front' | 'rear',
  slots: ComponentSlot[] = [],
): BikeAssembly {
  return {
    id,
    display_name: `Gruppe ${id}`,
    worst_status: 'ok',
    slots,
    intervals: [],
    group_detail: { category, position },
  } as unknown as BikeAssembly;
}

function slotWith(name: string, wearKm: number, weatherKm: number | null): ComponentSlot {
  return {
    id: wearKm,
    display_name: name,
    mounted_component: {
      id: wearKm,
      wear_km: wearKm,
      weather_wear_km: weatherKm,
      wear_ratio: 0.5,
      warn_status_overall: 'ok',
      effective_warn_km: 2000,
    } as unknown as BikeComponent,
  } as unknown as ComponentSlot;
}

describe('anchorFor', () => {
  it('liest die Seite aus dem Feld, nicht aus dem Namen', () => {
    const front = anchorFor('brakes', 'front', 'road')!;
    const rear = anchorFor('brakes', 'rear', 'road')!;
    expect(front.x).toBeGreaterThan(rear.x);
  });

  it('gibt Baugruppen ohne festen Ort keinen Punkt', () => {
    expect(anchorFor('accessories', '', 'gravel')).toBeNull();
  });
});

describe('buildCallouts', () => {
  const bike = [
    assembly(1, 'wheels', 'rear'),
    assembly(2, 'brakes', 'rear'),
    assembly(3, 'drivetrain', ''),
    assembly(4, 'wheels', 'front'),
    assembly(5, 'brakes', 'front'),
    assembly(6, 'cockpit', ''),
  ];

  it('beschriftet hintere Teile links und vordere rechts', () => {
    const callouts = buildCallouts(bike, 'gravel');
    const side = (id: number): string => callouts.find((c) => c.id === id)!.side;
    expect(side(1)).toBe('left');
    expect(side(3)).toBe('left');
    expect(side(4)).toBe('right');
    expect(side(6)).toBe('right');
  });

  it('hält die Reihenfolge je Seite, damit sich die Linien nicht kreuzen', () => {
    const callouts = buildCallouts(bike, 'gravel');
    for (const side of ['left', 'right']) {
      const column = callouts.filter((c) => c.side === side);
      const byLabel = [...column].sort((a, b) => a.labelY - b.labelY).map((c) => c.id);
      const byAnchor = [...column].sort((a, b) => a.anchorWide!.y - b.anchorWide!.y).map((c) => c.id);
      expect(byLabel).toEqual(byAnchor);
    }
  });

  it('bleibt auch bei vielen Baugruppen innerhalb der Zeichnung', () => {
    const many = [
      ...bike,
      assembly(7, 'suspension', 'front'),
      assembly(8, 'suspension', 'rear'),
      assembly(9, 'electric', ''),
      assembly(10, 'lighting', 'rear'),
      assembly(11, 'frame', ''),
    ];
    for (const callout of buildCallouts(many, 'ebike_mtb')) {
      expect(callout.labelY).toBeGreaterThan(0);
      expect(callout.labelY).toBeLessThan(WIDE.h);
    }
  });

  it('zieht zu Baugruppen ohne festen Ort keine Linie und vergibt keine Nummer', () => {
    const accessories = buildCallouts([...bike, assembly(7, 'accessories', '')], 'gravel').find(
      (c) => c.id === 7,
    )!;
    expect(accessories.leader).toBeNull();
    expect(accessories.number).toBeNull();
  });

  it('nummeriert durchgehend ohne Lücken', () => {
    const numbers = buildCallouts(bike, 'gravel').map((c) => c.number);
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('schiebt Nummern auseinander, die auf denselben Punkt fallen', () => {
    const twins = [assembly(1, 'drivetrain', ''), assembly(2, 'drivetrain', '')];
    const [a, b] = buildCallouts(twins, 'road');
    expect(a.anchorNarrow).not.toEqual(b.anchorNarrow);
  });
});

describe('largestWeatherGap', () => {
  it('nimmt das Teil mit dem größten Abstand und vergleicht zwei Zahlen desselben Teils', () => {
    const gap = largestWeatherGap([
      assembly(1, 'drivetrain', '', [slotWith('Kette', 1000, 1300), slotWith('Kurbel', 1000, 1050)]),
    ])!;
    expect(gap.partName).toBe('Kette');
    expect(gap.km).toBe(1000);
    expect(gap.weatherKm).toBe(1300);
    expect(gap.stretch).toBeCloseTo(1.3);
  });

  it('begrenzt die Länge der Linie, aber nicht die Zahl', () => {
    const gap = largestWeatherGap([assembly(1, 'drivetrain', '', [slotWith('Kette', 100, 900)])])!;
    expect(gap.stretch).toBe(1.4);
    expect(gap.weatherKm).toBe(900);
  });

  it('zeigt nichts, solange das Wetter nichts ausmacht', () => {
    expect(largestWeatherGap([assembly(1, 'wheels', 'rear', [slotWith('Reifen', 500, null)])])).toBeNull();
    expect(largestWeatherGap([assembly(1, 'wheels', 'rear', [slotWith('Reifen', 500, 501)])])).toBeNull();
  });
});
