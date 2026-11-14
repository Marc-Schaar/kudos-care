import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { NotificationService } from '../../../../shared/services/notification-service/notification-service';
import {
  AssembliesResponse,
  BikeAssembly,
  BikeComponent,
  ComponentSlot,
} from '../../models/maintenance.models';
import { BikeService } from '../../services/bike-service/bike-service';
import { LinksSheet } from './links-sheet';

/*
 * Der Fall aus Produktion: zwei Laufradsätze (Mavic am Rad, Devox im Keller), hinten zwei
 * Beläge im selben Platz, keiner davon montiert.
 */

function part(id: number, label: string, mounted = false): BikeComponent {
  return { id, label, is_mounted: mounted, wear_km: id * 10 } as BikeComponent;
}

function slot(id: number, name: string, position: 'front' | 'rear', parts: BikeComponent[]) {
  return {
    id,
    display_name: name,
    template_detail: { position, follows_wheel: true },
    mounted_component: parts.find((p) => p.is_mounted) ?? null,
    spare_components: parts.filter((p) => !p.is_mounted),
  } as unknown as ComponentSlot;
}

function wheel(
  id: number,
  name: string,
  position: 'front' | 'rear',
  active: boolean,
  links: number[],
  partner: number,
): BikeAssembly {
  return {
    id,
    group: position === 'front' ? 1 : 2,
    display_name: name,
    is_active: active,
    group_detail: { kind: 'assembly', position, sort_order: position === 'front' ? 1 : 2 },
    linked_component_ids: links,
    linked_assembly_ids: [partner],
    slots: [],
  } as unknown as BikeAssembly;
}

const BLUE = part(1, 'Die Blauen');
const YELLOW = part(13, 'Yellow King');
const YELLOW_FRONT = part(14, 'Yellow King vorne', true);
const BLUE_FRONT = part(2, 'Die Blauen vorne');
const CHAIN_LINK = 900;

function setup() {
  const mavicFront = wheel(17, 'Mavic', 'front', true, [14], 18);
  const mavicRear = wheel(18, 'Mavic', 'rear', true, [13, CHAIN_LINK], 17);
  const devoxFront = wheel(8, 'Devox', 'front', false, [2], 5);
  const devoxRear = wheel(5, 'Devox', 'rear', false, [1], 8);
  const brakeRear = {
    display_name: 'Bremse hinten',
    group_detail: { kind: 'area' },
    slots: [slot(40, 'Bremsbeläge hinten', 'rear', [BLUE, YELLOW])],
  };
  const brakeFront = {
    display_name: 'Bremse vorne',
    group_detail: { kind: 'area' },
    slots: [slot(41, 'Bremsbeläge vorne', 'front', [YELLOW_FRONT, BLUE_FRONT])],
  };
  const garage = {
    assemblies: [mavicFront, mavicRear, brakeRear, brakeFront],
    parked_assemblies: [devoxFront, devoxRear],
    ungrouped_slots: [],
  } as unknown as AssembliesResponse;

  // jsdom kennt <dialog> nur als Element, nicht seine Methoden.
  HTMLDialogElement.prototype.showModal ??= function () {};
  HTMLDialogElement.prototype.close ??= function () {};

  const setAssemblyLinks = vi.fn(() => of({}));
  TestBed.configureTestingModule({
    imports: [LinksSheet],
    providers: [
      { provide: BikeService, useValue: { setAssemblyLinks, addComponent: vi.fn() } },
      { provide: NotificationService, useValue: { show: vi.fn() } },
    ],
  });
  const fixture = TestBed.createComponent(LinksSheet);
  fixture.componentRef.setInput('wheels', [mavicFront, mavicRear]);
  fixture.componentRef.setInput('garage', garage);
  fixture.detectChanges();
  return { sheet: fixture.componentInstance, setAssemblyLinks, mavicRear, devoxRear };
}

describe('LinksSheet', () => {
  it('zeigt je Platz eine Tafel mit allen Laufrädern der Seite, die geöffneten zuerst', () => {
    const { sheet } = setup();
    const rear = sheet.boards().find((b) => b.slot.id === 40)!;

    expect(sheet.boards().length).toBe(2);
    expect(rear.wheels.map((w) => w.id)).toEqual([18, 5]);
    expect(rear.parts.map((p) => p.id)).toEqual([1, 13]);
  });

  it('steckt die bestehenden Kopplungen', () => {
    const { sheet } = setup();
    const rear = sheet.boards().find((b) => b.slot.id === 40)!;

    expect(rear.pegs()).toEqual({ 18: 13, 5: 1 });
  });

  it('meldet, wenn hinten gerade nichts montiert ist', () => {
    const { sheet } = setup();
    const [rear, front] = [40, 41].map((id) => sheet.boards().find((b) => b.slot.id === id)!);

    expect(sheet.nothingMounted(rear)).toBe(true);
    expect(sheet.nothingMounted(front)).toBe(false);
  });

  it('schreibt umgesteckte Paarungen und lässt Unverändertes in Ruhe', () => {
    const { sheet, setAssemblyLinks, mavicRear, devoxRear } = setup();
    const rear = sheet.boards().find((b) => b.slot.id === 40)!;

    sheet.setPeg(rear, mavicRear, BLUE.id);
    sheet.setPeg(rear, devoxRear, YELLOW.id);
    sheet.save();

    const calls = new Map(
      setAssemblyLinks.mock.calls.map((call) => {
        const [id, , components] = call as unknown as [number, number[], number[]];
        return [id, [...components].sort((a, b) => a - b)];
      }),
    );
    // Die Kette an Mavic hinten steht auf keiner Tafel und bleibt gekoppelt.
    expect(calls.get(18)).toEqual([1, CHAIN_LINK]);
    expect(calls.get(5)).toEqual([13]);
    // Geöffnet, also geschrieben, aber unverändert.
    expect(calls.get(17)).toEqual([14]);
    // Weder geöffnet noch geändert: kein Aufruf.
    expect(calls.has(8)).toBe(false);
  });

  it('entkoppelt mit "Nichts koppeln"', () => {
    const { sheet, setAssemblyLinks, devoxRear } = setup();
    const rear = sheet.boards().find((b) => b.slot.id === 40)!;

    sheet.setPeg(rear, devoxRear, null);
    sheet.save();

    const devox = setAssemblyLinks.mock.calls.find((call) => (call as unknown[])[0] === 5);
    expect((devox as unknown[])[2]).toEqual([]);
    expect(sheet.unpegged(rear).map((w) => w.id)).toEqual([5]);
  });
});
