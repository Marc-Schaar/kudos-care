import { Component, computed, input, output } from '@angular/core';
import { BikeType, ComponentSlotList } from '../../models/maintenance.models';
import { WarnClassPipe } from '../../pipes/warn-class/warn-class-pipe';
import { WarnLabelPipe } from '../../pipes/warn-label/warn-label-pipe';

interface Point {
  x: number;
  y: number;
}

interface BatteryRect {
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
}

interface DiagramGeometry {
  rearWheel: Point;
  frontWheel: Point;
  wheelRadius: number;
  bb: Point;
  seatTop: Point;
  headTop: Point;
  headBottom: Point;
  stemEnd: Point;
  batteryCenter: Point;
  framePath: string;
  forkPaths: string[];
  barPath: string;
  saddlePath: string;
  crankPath: string;
  batteryRect: BatteryRect | null;
  rackPath: string | null;
  fenderPaths: string[] | null;
  knobby: boolean;
}

export interface DiagramDot {
  slot: ComponentSlotList;
  x: number;
  y: number;
}

// Stil-Merkmale je Bike-Typ — bestimmen welche Rahmen-/Anbauteile die
// SVG-Silhouette bekommt (Rennlenker vs. Flat-/Swept-Bar, Federgabel,
// grobstollige Reifen, Gepäckträger/Schutzbleche, Akku-Block).
const DROP_BAR_TYPES: BikeType[] = ['road', 'gravel', 'cx', 'ebike_road'];
const SUSPENSION_TYPES: BikeType[] = ['mtb', 'ebike_mtb'];
const KNOBBY_TYPES: BikeType[] = ['mtb', 'gravel', 'cx', 'ebike_mtb'];
const SWEPT_BAR_TYPES: BikeType[] = ['city', 'ebike_city', 'other'];
const RACK_TYPES: BikeType[] = ['city', 'ebike_city'];
const BATTERY_TYPES: BikeType[] = ['ebike_road', 'ebike_mtb', 'ebike_city'];

@Component({
  selector: 'app-bike-diagram-component',
  imports: [WarnClassPipe, WarnLabelPipe],
  templateUrl: './bike-diagram-component.html',
  styleUrl: './bike-diagram-component.css',
})
export class BikeDiagramComponent {
  bikeType = input.required<BikeType>();
  slots = input<ComponentSlotList[]>([]);
  dotClick = output<number>();

  geometry = computed<DiagramGeometry>(() => this.buildGeometry(this.bikeType()));
  dots = computed<DiagramDot[]>(() => this.buildDots(this.slots(), this.geometry()));

  private buildGeometry(type: BikeType): DiagramGeometry {
    const dropBar = DROP_BAR_TYPES.includes(type);
    const suspension = SUSPENSION_TYPES.includes(type);
    const knobby = KNOBBY_TYPES.includes(type);
    const sweptBar = SWEPT_BAR_TYPES.includes(type);
    const rack = RACK_TYPES.includes(type);
    const battery = BATTERY_TYPES.includes(type);

    const rearWheel: Point = { x: 95, y: 150 };
    const frontWheel: Point = { x: 305, y: 150 };
    const bb: Point = { x: 168, y: 150 };
    const seatTop: Point = { x: 148, y: dropBar ? 58 : 50 };
    const headTop: Point = dropBar ? { x: 268, y: 78 } : { x: 272, y: sweptBar ? 66 : 60 };
    const headBottom: Point = { x: headTop.x + 10, y: headTop.y + (suspension ? 46 : 32) };
    const stemEnd: Point = sweptBar
      ? { x: headTop.x + 4, y: headTop.y - 24 }
      : { x: headTop.x + 18, y: headTop.y - 12 };

    const framePath = [
      `M ${bb.x} ${bb.y}`,
      `L ${seatTop.x} ${seatTop.y}`,
      `L ${headTop.x} ${headTop.y}`,
      `M ${bb.x} ${bb.y}`,
      `L ${headBottom.x} ${headBottom.y}`,
      `M ${seatTop.x} ${seatTop.y}`,
      `L ${rearWheel.x} ${rearWheel.y}`,
      `M ${bb.x} ${bb.y}`,
      `L ${rearWheel.x} ${rearWheel.y}`,
    ].join(' ');

    const forkPaths = suspension
      ? [
          `M ${headBottom.x - 4} ${headBottom.y} L ${frontWheel.x - 6} ${frontWheel.y}`,
          `M ${headBottom.x + 4} ${headBottom.y} L ${frontWheel.x + 6} ${frontWheel.y}`,
        ]
      : [`M ${headBottom.x} ${headBottom.y} L ${frontWheel.x} ${frontWheel.y}`];

    const barPath = dropBar
      ? `M ${stemEnd.x} ${stemEnd.y} q 18 -4 20 10 q 2 14 -14 16 q -10 1 -8 -9`
      : sweptBar
        ? `M ${stemEnd.x - 22} ${stemEnd.y + 6} Q ${stemEnd.x} ${stemEnd.y - 10} ${stemEnd.x + 20} ${stemEnd.y - 2}`
        : `M ${stemEnd.x - 22} ${stemEnd.y} L ${stemEnd.x + 22} ${stemEnd.y}`;

    const saddlePath = `M ${seatTop.x - 16} ${seatTop.y - 4} Q ${seatTop.x - 2} ${seatTop.y - 10} ${seatTop.x + 16} ${seatTop.y - 5} L ${seatTop.x + 14} ${seatTop.y} L ${seatTop.x - 16} ${seatTop.y} Z`;

    const crankPath = `M ${bb.x - 14} ${bb.y + 10} L ${bb.x + 14} ${bb.y - 10}`;

    const batteryCenter: Point = {
      x: (bb.x + headBottom.x) / 2,
      y: (bb.y + headBottom.y) / 2 - 4,
    };

    const batteryRect = battery
      ? {
          x: batteryCenter.x - 26,
          y: batteryCenter.y - 8,
          w: 52,
          h: 16,
          rot: this.angleDeg(bb, headBottom),
        }
      : null;

    const rackPath = rack
      ? `M ${seatTop.x - 2} ${seatTop.y} L ${rearWheel.x - 28} ${rearWheel.y - 44} L ${rearWheel.x + 24} ${rearWheel.y - 44} M ${rearWheel.x - 28} ${rearWheel.y - 44} L ${rearWheel.x - 20} ${rearWheel.y - 26}`
      : null;

    const fenderPaths = rack
      ? [this.fenderArc(frontWheel, 46), this.fenderArc(rearWheel, 46)]
      : null;

    return {
      rearWheel,
      frontWheel,
      wheelRadius: 40,
      bb,
      seatTop,
      headTop,
      headBottom,
      stemEnd,
      batteryCenter,
      framePath,
      forkPaths,
      barPath,
      saddlePath,
      crankPath,
      batteryRect,
      rackPath,
      fenderPaths,
      knobby,
    };
  }

  private angleDeg(a: Point, b: Point): number {
    return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  }

  private fenderArc(center: Point, radius: number): string {
    const startX = center.x - radius * 0.9;
    const startY = center.y - radius * 0.3;
    const endX = center.x + radius * 0.9;
    const endY = center.y - radius * 0.3;
    return `M ${startX} ${startY} A ${radius} ${radius} 0 0 1 ${endX} ${endY}`;
  }

  private buildDots(slots: ComponentSlotList[], geo: DiagramGeometry): DiagramDot[] {
    const raw = slots.map((slot) => {
      const pos = this.positionFor(slot, geo);
      return { slot, x: pos.x, y: pos.y };
    });

    // Slots die auf denselben Punkt fallen (z.B. zwei generische Frame-Slots)
    // leicht auffächern, damit jeder Dot einzeln klickbar bleibt.
    const groups = new Map<string, DiagramDot[]>();
    for (const item of raw) {
      const key = `${Math.round(item.x)}:${Math.round(item.y)}`;
      const list = groups.get(key) ?? [];
      list.push(item);
      groups.set(key, list);
    }

    const result: DiagramDot[] = [];
    for (const group of groups.values()) {
      if (group.length === 1) {
        result.push(group[0]);
        continue;
      }
      const spacing = 13;
      const startOffset = -((group.length - 1) * spacing) / 2;
      group.forEach((item, i) => {
        result.push({ slot: item.slot, x: item.x + startOffset + i * spacing, y: item.y });
      });
    }
    return result;
  }

  private positionFor(slot: ComponentSlotList, geo: DiagramGeometry): Point {
    const name = slot.display_name.toLowerCase();
    const front = name.includes('vorne') || name.includes('front');
    const rear = name.includes('hinten') || name.includes('rück');

    switch (slot.category) {
      case 'wheels':
        return front ? geo.frontWheel : rear ? geo.rearWheel : geo.frontWheel;

      case 'brakes':
        if (rear) return { x: geo.rearWheel.x, y: geo.rearWheel.y - geo.wheelRadius - 6 };
        return { x: geo.frontWheel.x, y: geo.frontWheel.y - geo.wheelRadius - 6 };

      case 'drivetrain':
        if (/kassette|schaltwerk|schaltröllchen|freilauf|zahnriemen|ritzel/.test(name)) {
          return { x: geo.rearWheel.x + 10, y: geo.rearWheel.y - 8 };
        }
        if (name.includes('umwerfer')) {
          return { x: geo.bb.x + 6, y: geo.bb.y - 20 };
        }
        return geo.bb;

      case 'suspension':
        if (name.includes('dämpfer')) {
          return { x: (geo.seatTop.x + geo.bb.x) / 2, y: (geo.seatTop.y + geo.bb.y) / 2 };
        }
        return {
          x: (geo.headBottom.x + geo.frontWheel.x) / 2,
          y: (geo.headBottom.y + geo.frontWheel.y) / 2 - 6,
        };

      case 'cockpit':
        if (name.includes('sattel')) return { x: geo.seatTop.x, y: geo.seatTop.y - 6 };
        if (name.includes('pedale')) return { x: geo.bb.x, y: geo.bb.y + 16 };
        return geo.stemEnd;

      case 'frame':
        if (name.includes('hinterbau') || name.includes('umlenk')) {
          return { x: (geo.bb.x + geo.rearWheel.x) / 2, y: (geo.bb.y + geo.rearWheel.y) / 2 - 14 };
        }
        return geo.headTop;

      case 'electric':
        if (name.includes('motor')) return geo.bb;
        if (name.includes('display')) return geo.stemEnd;
        return geo.batteryCenter;

      case 'lighting':
        if (rear) return { x: geo.seatTop.x - 6, y: geo.seatTop.y + 10 };
        return { x: geo.headBottom.x + 4, y: geo.headBottom.y - 4 };

      default:
        return geo.bb;
    }
  }
}
