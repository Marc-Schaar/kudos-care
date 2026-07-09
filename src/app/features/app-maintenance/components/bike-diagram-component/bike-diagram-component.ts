import { Component, computed, input, output } from '@angular/core';
import { BikeType, ComponentSlotList } from '../../models/maintenance.models';
import { WarnClassPipe } from '../../pipes/warn-class/warn-class-pipe';
import { WarnLabelPipe } from '../../pipes/warn-label/warn-label-pipe';

interface Point {
  x: number;
  y: number;
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
}

export interface DiagramDot {
  slot: ComponentSlotList;
  x: number;
  y: number;
}

// Stil-Merkmale je Bike-Typ — bestimmen Lenkerform/Gabel und damit die
// Landmark-Punkte, auf denen die Slot-Dots über der Bike-Illustration
// positioniert werden. Muss in sync mit den Proportionen der SVGs unter
// public/bike-illustrations/ bleiben.
const DROP_BAR_TYPES: BikeType[] = ['road', 'gravel', 'cx', 'ebike_road'];
const SUSPENSION_TYPES: BikeType[] = ['mtb', 'ebike_mtb'];
const SWEPT_BAR_TYPES: BikeType[] = ['city', 'ebike_city', 'other'];

// Austauschbare Vektor-Illustration je Bike-Typ. Datei ersetzen, um das
// Bild für einen Typ zu ändern — die Slot-Dots richten sich automatisch
// nach den Landmark-Punkten in buildGeometry() aus.
const BIKE_IMAGES: Record<BikeType, string> = {
  road: 'bike-illustrations/road.svg',
  gravel: 'bike-illustrations/gravel.svg',
  cx: 'bike-illustrations/cx.svg',
  ebike_road: 'bike-illustrations/ebike_road.svg',
  mtb: 'bike-illustrations/mtb.svg',
  ebike_mtb: 'bike-illustrations/ebike_mtb.svg',
  city: 'bike-illustrations/city.svg',
  ebike_city: 'bike-illustrations/ebike_city.svg',
  other: 'bike-illustrations/other.svg',
};

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

  imageSrc = computed<string>(() => BIKE_IMAGES[this.bikeType()]);
  geometry = computed<DiagramGeometry>(() => this.buildGeometry(this.bikeType()));
  dots = computed<DiagramDot[]>(() => this.buildDots(this.slots(), this.geometry()));

  private buildGeometry(type: BikeType): DiagramGeometry {
    const dropBar = DROP_BAR_TYPES.includes(type);
    const suspension = SUSPENSION_TYPES.includes(type);
    const sweptBar = SWEPT_BAR_TYPES.includes(type);

    const rearWheel: Point = { x: 94, y: 134 };
    const frontWheel: Point = { x: 312, y: 134 };
    const bb: Point = { x: 178, y: 141 };

    let seatTop: Point;
    let headTop: Point;
    let headBottom: Point;
    if (dropBar) {
      seatTop = { x: 154, y: 46 };
      headTop = { x: 278, y: 42 };
      headBottom = { x: 287, y: 66 };
    } else if (suspension) {
      seatTop = { x: 154, y: 40 };
      headTop = { x: 269, y: 38 };
      headBottom = { x: 281, y: 65 };
    } else {
      seatTop = { x: 154, y: 44 };
      headTop = { x: 278, y: 32 };
      headBottom = { x: 290, y: 68 };
    }

    const stemEnd: Point = dropBar
      ? { x: headTop.x + 16, y: headTop.y - 12 }
      : sweptBar
        ? { x: headTop.x + 5, y: headTop.y - 22 }
        : { x: headTop.x + 18, y: headTop.y - 14 };

    const batteryCenter: Point = {
      x: (bb.x + headBottom.x) / 2,
      y: (bb.y + headBottom.y) / 2 - 3,
    };

    return {
      rearWheel,
      frontWheel,
      wheelRadius: 58,
      bb,
      seatTop,
      headTop,
      headBottom,
      stemEnd,
      batteryCenter,
    };
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
